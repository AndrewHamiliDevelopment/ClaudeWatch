const STATUSES = ['busy', 'idle', 'waiting', 'shell'] as const
type RegistryStatus = (typeof STATUSES)[number]
const isStatus = (value: unknown): value is RegistryStatus =>
  STATUSES.some((status) => status === value)
const SESSION_ID = /^[\w-]+$/

export interface RegistryEntry {
  pid: number
  sessionId: string
  cwd: string
  name: string
  status: RegistryStatus
  waitingFor: string
  procStart: string
  updatedAtMs: number
}

import { join } from 'node:path'
import type { SessionRef, SourceHealth } from '../shared/office/types'
import { type BridgeIo, isMissing, jsonObject } from './io'
import { isLive } from './liveness'
import { sessionFromRegistry, sessionFromTeammate } from './claude'
import { resolveProject } from './project-root'
import { parseTranscript, transcriptPath } from './transcript-tail'
import { listAgentFiles, liveSubagents } from './subagents'
import { type ProcessRow, readProcessTable } from './process-table'
import { type Teammate, type TeammateProcess, teammateProcesses, TeammateSource } from './teammates'
import type { SessionFiles } from './usage-tracker'

function parseRegistry(text: string): RegistryEntry | null {
  const record = jsonObject(text)
  if (
    !record ||
    typeof record.pid !== 'number' ||
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 0 ||
    typeof record.sessionId !== 'string' ||
    !SESSION_ID.test(record.sessionId) ||
    typeof record.cwd !== 'string' ||
    !record.cwd.startsWith('/') ||
    typeof record.procStart !== 'string' ||
    !isStatus(record.status)
  )
    return null
  const stamp = record.statusUpdatedAt ?? record.updatedAt
  const updatedAtMs =
    typeof stamp === 'number' ? stamp : typeof stamp === 'string' ? Date.parse(stamp) : 0
  return {
    pid: record.pid,
    sessionId: record.sessionId,
    cwd: record.cwd,
    name: typeof record.name === 'string' ? record.name : '',
    status: record.status,
    waitingFor: typeof record.waitingFor === 'string' ? record.waitingFor : '',
    procStart: record.procStart,
    updatedAtMs: Number.isFinite(updatedAtMs) ? updatedAtMs : 0
  }
}

export interface ClaudeBatch {
  sessions: SessionRef[]
  sources: SourceHealth[]
  // The transcripts behind each session, by session key, for the token counters.
  transcripts: Map<string, SessionFiles>
}

export async function collectClaude(
  roots: string[],
  io: BridgeIo,
  now: number,
  teammates = new TeammateSource(io),
  readProcesses = (): Promise<ProcessRow[]> => readProcessTable(io)
): Promise<ClaudeBatch> {
  const sessions: SessionRef[] = []
  const sources: SourceHealth[] = []
  const transcripts = new Map<string, SessionFiles>()
  // Read at most once per tick.
  let processTable: Promise<ProcessRow[]> | undefined
  const table = (): Promise<ProcessRow[]> => (processTable ??= readProcesses())
  let teammateTable: Promise<TeammateProcess[]> | undefined
  const processes = (): Promise<TeammateProcess[]> =>
    (teammateTable ??= table().then(teammateProcesses))
  const uniqueRoots = [...new Set(roots)]
  const liveSessionIds = new Set<string>()
  for (const root of uniqueRoots) {
    const health: SourceHealth = { id: `claude:${root}`, ok: true, detail: 'empty' }
    try {
      const files = await io.list(join(root, 'sessions'))
      for (const file of files.filter((name) => /^\d+\.json$/.test(name))) {
        try {
          const entry = parseRegistry(await io.readText(join(root, 'sessions', file)))
          // An unreadable table proves nothing either way: each pid is then asked about.
          if (!entry || !(await isLive(entry, io, await table().catch(() => [])))) continue
          liveSessionIds.add(entry.sessionId)
          const project = await resolveProject(entry.cwd, io)
          const path = await transcriptPath(root, entry.cwd, entry.sessionId, io)
          const transcript = path
            ? parseTranscript(await io.readTail(path))
            : { tool: null, error: false }
          const agentFiles = path ? await listAgentFiles(path, io) : []
          const agents = await liveSubagents(agentFiles, io, now)
          // A team that cannot be read costs the lead its teammates, never the lead itself.
          const team = await teammates
            .collect(root, entry.sessionId, entry.cwd, processes, now)
            .catch(() => null)
          const session = sessionFromRegistry(
            entry,
            transcript,
            [...agents, ...(team ?? []).map((teammate) => teammate.ref)],
            project.root,
            project.worktree
          )
          sessions.push(session)
          if (path)
            transcripts.set(session.key, {
              main: path,
              agents: agentFiles,
              teammates: new Map(
                (team ?? []).map((teammate) => [teammate.ref.id, teammate.transcripts])
              )
            })
          if (health.ok) health.detail = 'live'
          if (!team) {
            health.ok = false
            health.detail = 'team read failed'
          }
        } catch (error) {
          if (!isMissing(error)) {
            health.ok = false
            health.detail = 'session read failed'
          }
        }
      }
    } catch (error) {
      if (!isMissing(error)) {
        health.ok = false
        health.detail = 'registry read failed'
      }
    }
    sources.push(health)
  }
  // Who has no lead cannot be told while a registry is unread: it may hold the lead.
  if (sources.every((source) => source.ok)) {
    const parents = (await processes().catch(() => [])).map((p) => p.parentSessionId)
    for (const leadSessionId of new Set(parents)) {
      if (liveSessionIds.has(leadSessionId) || !SESSION_ID.test(leadSessionId)) continue
      for (const root of uniqueRoots) {
        const orphans = await teammates
          .collect(root, leadSessionId, null, processes, now)
          .catch(() => [])
        for (const orphan of orphans) {
          const files = await orphanSession(orphan, io).catch(() => null)
          if (!files) continue
          sessions.push(files.session)
          if (files.transcripts) transcripts.set(files.session.key, files.transcripts)
        }
      }
    }
  }
  teammates.prune()
  return { sessions, sources, transcripts }
}

// A teammate outlives its lead when the lead exits first. It still runs in its own process
// and pane, so it is shown as a session of its own until it exits too.
async function orphanSession(
  { ref, transcripts: [main] }: Teammate,
  io: BridgeIo
): Promise<{ session: SessionRef; transcripts: SessionFiles | null } | null> {
  const { cwd, pid } = ref
  if (!cwd || typeof pid !== 'number') return null
  const project = await resolveProject(cwd, io)
  return {
    session: sessionFromTeammate({ ...ref, cwd, pid }, project.root, project.worktree),
    transcripts: main
      ? { main, agents: await listAgentFiles(main, io), teammates: new Map() }
      : null
  }
}
