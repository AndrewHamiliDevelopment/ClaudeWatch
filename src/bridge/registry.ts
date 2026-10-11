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
import { collectSubagents } from './subagents'

export function parseRegistry(text: string): RegistryEntry | null {
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

export async function collectClaude(
  roots: string[],
  io: BridgeIo,
  now: number
): Promise<{ sessions: SessionRef[]; sources: SourceHealth[] }> {
  const sessions: SessionRef[] = []
  const sources: SourceHealth[] = []
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
          const agents = path ? await collectSubagents(path, io, now) : []
          sessions.push(
            sessionFromRegistry(entry, transcript, agents, project.root, project.worktree)
          )
          health.detail = 'live'
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
  return { sessions, sources }
}
