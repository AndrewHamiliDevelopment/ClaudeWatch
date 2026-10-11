export interface RegistryEntry {
  pid: number
  sessionId: string
  cwd: string
  name: string
  status: 'busy' | 'idle' | 'waiting' | 'shell'
  waitingFor: string
  procStart: string
  updatedAtMs: number
}

import { join } from 'node:path'
import type { SessionRef, SourceHealth } from '../shared/office/types'
import { type BridgeIo, isMissing, jsonObject } from './io'
import { isLive } from './liveness'
import { sessionFromRegistry } from './claude'
import { resolveProject } from './project-root'
import { parseTranscript, transcriptPath } from './transcript-tail'
import { listAgentFiles, liveSubagents } from './subagents'
import { PROCESS_TABLE_ARGS } from './process-table'
import { parseTeammateProcesses, type TeammateProcess, TeammateSource } from './teammates'
import type { SessionFiles } from './usage-tracker'

function parseRegistry(text: string): RegistryEntry | null {
  const record = jsonObject(text)
  if (
    !record ||
    typeof record.pid !== 'number' ||
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 0 ||
    typeof record.sessionId !== 'string' ||
    !/^[\w-]+$/.test(record.sessionId) ||
    typeof record.cwd !== 'string' ||
    !record.cwd.startsWith('/') ||
    typeof record.procStart !== 'string' ||
    !['busy', 'idle', 'waiting', 'shell'].includes(String(record.status))
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
    status: record.status as RegistryEntry['status'],
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
  teammates = new TeammateSource(io)
): Promise<ClaudeBatch> {
  const sessions: SessionRef[] = []
  const sources: SourceHealth[] = []
  const transcripts = new Map<string, SessionFiles>()
  // Read at most once per tick, and only when some session leads a team.
  let processTable: Promise<TeammateProcess[]> | undefined
  const processes = (): Promise<TeammateProcess[]> =>
    (processTable ??= io.exec('/bin/ps', PROCESS_TABLE_ARGS).then(parseTeammateProcesses))
  for (const root of [...new Set(roots)]) {
    const health: SourceHealth = { id: `claude:${root}`, ok: true, detail: 'empty' }
    try {
      const files = await io.list(join(root, 'sessions'))
      for (const file of files.filter((name) => /^\d+\.json$/.test(name))) {
        try {
          const entry = parseRegistry(await io.readText(join(root, 'sessions', file)))
          if (!entry || !(await isLive(entry, io))) continue
          const project = await resolveProject(entry.cwd, io)
          const path = await transcriptPath(root, entry.cwd, entry.sessionId, io)
          const transcript = path
            ? parseTranscript(await io.readTail(path))
            : { tool: null, error: false }
          const agentFiles = path ? await listAgentFiles(path, io) : []
          const agents = await liveSubagents(agentFiles, io, now)
          // A team that cannot be read costs the lead its teammates, never the lead itself.
          const team = await teammates
            .collect(root, entry.sessionId, processes, now)
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
          health.detail = 'live'
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
  teammates.prune()
  return { sessions, sources, transcripts }
}
