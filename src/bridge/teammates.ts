import { join } from 'node:path'
import type { AgentActivity, SubagentRef } from '../shared/office/types'
import { type BridgeIo, isMissing, jsonObject, object } from './io'
import { parseProcessTable } from './process-table'
import { listAgentFiles } from './subagents'
import { newestTeammateTranscripts } from './teammate-transcripts'
import { toolActivity } from './tool-category'
import { parseTranscript, projectSlug } from './transcript-tail'

export interface TeammateProcess {
  pid: number
  startedAtMs: number
  agentId: string
  parentSessionId: string
}

export interface Teammate {
  ref: SubagentRef
  // Its own transcript, then those of the agents it spawned; empty while none can be tied.
  transcripts: string[]
}

interface LiveMember {
  identity: string
  agentId: string
  name: string
  agentType: string
  cwd: string | null
  joinedAtMs: number
  process: TeammateProcess
}

const LABEL = /^[\w.-]{1,64}$/
const AGENT_ID = /^[\w.-]{1,64}@[\w.-]{1,64}$/
const SEARCH_INTERVAL_MS = 10000
const FRESH_MS = 60000

// A teammate is its own process, started with the agent id and its lead's session id as flags.
export function parseTeammateProcesses(output: string): TeammateProcess[] {
  const teammates: TeammateProcess[] = []
  for (const { pid, startedAtMs, argv } of parseProcessTable(output)) {
    const flagValue = (flag: string): string | undefined =>
      argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : undefined
    const agentId = flagValue('--agent-id')
    const parentSessionId = flagValue('--parent-session-id')
    if (agentId && parentSessionId) teammates.push({ pid, startedAtMs, agentId, parentSessionId })
  }
  return teammates
}

export class TeammateSource {
  private transcripts = new Map<string, string>()
  private searchAgainAt = new Map<string, number>()
  private seen = new Set<string>()

  constructor(private readonly io: BridgeIo) {}

  // Teammates write no registry file: the roster names them and the process table proves
  // which are alive. `processes` is asked only when the session leads a team.
  async collect(
    root: string,
    leadSessionId: string,
    processes: () => Promise<TeammateProcess[]>,
    now: number
  ): Promise<Teammate[]> {
    const team = `session-${leadSessionId.slice(0, 8)}`
    let roster: Record<string, unknown> | null
    try {
      roster = jsonObject(await this.io.readText(join(root, 'teams', team, 'config.json')))
    } catch (error) {
      if (isMissing(error)) return []
      throw error
    }
    // Eight characters can collide, so the roster must name this lead in full.
    if (roster?.leadSessionId !== leadSessionId || !Array.isArray(roster.members)) return []
    const live = (await processes()).filter((p) => p.parentSessionId === leadSessionId)
    const members = roster.members
      .flatMap((value) => this.liveMember(root, object(value), live))
      .sort((a, b) => a.agentId.localeCompare(b.agentId))
    await this.tieTranscripts(root, team, members, now)
    const teammates: Teammate[] = []
    for (const member of members) {
      const activity = await this.activity(member.identity, now)
      const own = this.transcripts.get(member.identity)
      const spawned = own ? await listAgentFiles(own, this.io) : []
      teammates.push({
        transcripts: own ? [own, ...spawned.map((file) => file.path)] : [],
        ref: {
          id: member.agentId,
          type: member.agentType,
          activity,
          kind: 'teammate',
          name: member.name,
          pid: member.process.pid,
          startedAtMs: member.process.startedAtMs,
          orcaPaneKey: null,
          tokens: null
        }
      })
    }
    return teammates
  }

  // Drops what is remembered about teammates not seen since the last call.
  prune(): void {
    for (const identity of this.transcripts.keys())
      if (!this.seen.has(identity)) this.transcripts.delete(identity)
    for (const identity of this.searchAgainAt.keys())
      if (!this.seen.has(identity)) this.searchAgainAt.delete(identity)
    this.seen.clear()
  }

  private liveMember(
    root: string,
    member: Record<string, unknown> | null,
    live: TeammateProcess[]
  ): LiveMember[] {
    const process = live.find((p) => p.agentId === member?.agentId)
    if (
      !member ||
      !process ||
      !AGENT_ID.test(process.agentId) ||
      typeof member.name !== 'string' ||
      !LABEL.test(member.name) ||
      typeof member.agentType !== 'string'
    )
      return []
    const identity = `${root}\n${process.agentId}\n${process.pid}:${process.startedAtMs}`
    this.seen.add(identity)
    return [
      {
        identity,
        agentId: process.agentId,
        name: member.name,
        agentType: member.agentType,
        cwd: typeof member.cwd === 'string' && member.cwd.startsWith('/') ? member.cwd : null,
        joinedAtMs: typeof member.joinedAt === 'number' ? member.joinedAt : 0,
        process
      }
    ]
  }

  private async tieTranscripts(
    root: string,
    team: string,
    members: LiveMember[],
    now: number
  ): Promise<void> {
    const searches = new Map<string, LiveMember[]>()
    for (const member of members) {
      if (!member.cwd || this.transcripts.has(member.identity)) continue
      if (now < (this.searchAgainAt.get(member.identity) ?? 0)) continue
      this.searchAgainAt.set(member.identity, now + SEARCH_INTERVAL_MS)
      const folder = join(root, 'projects', projectSlug(member.cwd))
      searches.set(folder, [...(searches.get(folder) ?? []), member])
    }
    for (const [folder, wanted] of searches) {
      try {
        const since = Math.min(...wanted.map((member) => member.joinedAtMs))
        const newest = await newestTeammateTranscripts(folder, team, since, this.io)
        for (const member of wanted) {
          const path = newest.get(member.name)
          if (!path) continue
          this.transcripts.set(member.identity, path)
          this.searchAgainAt.delete(member.identity)
        }
      } catch {
        // An unreadable folder leaves its teammates untied; they still show, as thinking.
      }
    }
  }

  // A teammate has no registry status: an unfinished tool shows as that tool, a transcript
  // written in the last minute as thinking, anything older as idle.
  private async activity(identity: string, now: number): Promise<AgentActivity> {
    const path = this.transcripts.get(identity)
    if (!path) return 'thinking'
    try {
      const { mtimeMs } = await this.io.stat(path)
      const { tool } = parseTranscript(await this.io.readTail(path))
      if (tool) return toolActivity(tool.category)
      return now - mtimeMs < FRESH_MS ? 'thinking' : 'idle'
    } catch {
      // The transcript went away or cannot be read: look for it again, later.
      this.transcripts.delete(identity)
      this.searchAgainAt.set(identity, now + SEARCH_INTERVAL_MS)
      return 'thinking'
    }
  }
}
