import { basename, dirname } from 'node:path'
import type {
  AgentActivity,
  AgentAttention,
  SessionRef,
  SessionUsage,
  SourceHealth
} from '../shared/office/types'
import { projectKey } from '../shared/office/project-key'
import { type BridgeIo, jsonObject, object } from './io'
import { resolveProject } from './project-root'
import { findRollouts } from './codex-rollouts'
import { parseCodexUsage } from './codex-usage'
import { type ProcessRow, readProcessTable } from './process-table'

export function codexProcesses(rows: ProcessRow[]): { pid: number; startedAtMs: number }[] {
  return rows
    .filter(
      ({ argv }) =>
        basename(argv[0]) === 'codex' &&
        !argv.slice(1).some((arg) => /^(app-server|helper)/.test(arg))
    )
    .map(({ pid, startedAtMs }) => ({ pid, startedAtMs }))
}
export function parseCodexActivity(tail: string): {
  activity: AgentActivity
  attention: AgentAttention
  updatedAtMs: number
} {
  let activity: AgentActivity = 'idle'
  let attention: AgentAttention = 'none'
  let updatedAtMs = 0
  for (const line of tail.split('\n')) {
    const record = jsonObject(line)
    // Current CLI rollouts place tool/reasoning events in response_item records.
    if (record?.type !== 'event_msg' && record?.type !== 'response_item') continue
    const type = object(record.payload)?.type
    if (type === 'function_call' || type === 'custom_tool_call') activity = 'running'
    else if (type === 'reasoning') activity = 'thinking'
    else if (type === 'task_complete') activity = 'idle'
    else continue
    attention = type === 'task_complete' ? 'done' : 'none'
    const timestamp = typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : 0
    updatedAtMs = Number.isFinite(timestamp) ? timestamp : 0
  }
  return { activity, attention, updatedAtMs }
}

// The usage last read from each live rollout. A long tool output pushes the newest
// `token_count` out of the 64 KB tail, and the total it gave still stands until the next one.
const lastUsage = new WeakMap<BridgeIo, Map<string, SessionUsage>>()

export async function collectCodex(
  root: string,
  io: BridgeIo,
  readProcesses = (): Promise<ProcessRow[]> => readProcessTable(io),
  derivesAccounts = false
): Promise<{ sessions: SessionRef[]; sources: SourceHealth[] }> {
  const sessions: SessionRef[] = []
  const health: SourceHealth = { id: 'codex', ok: true, detail: 'empty' }
  let known = lastUsage.get(io)
  if (!known) lastUsage.set(io, (known = new Map()))
  const live = new Set<string>()
  try {
    const processes = codexProcesses(await readProcesses())
    const rollouts = processes.length ? await findRollouts(root, io, derivesAccounts) : []
    const used = new Set<string>()
    for (const process of processes) {
      try {
        const cwdOutput = await io.exec('/usr/sbin/lsof', [
          '-a',
          '-p',
          String(process.pid),
          '-d',
          'cwd',
          '-Fn'
        ])
        const cwd = cwdOutput
          .split('\n')
          .find((line) => line.startsWith('n/'))
          ?.slice(1)
        // Codex bundled in an app (ChatGPT, Orca helpers) runs from inside the bundle; not a session.
        if (!cwd || /\.app\/Contents(\/|$)/.test(cwd)) continue
        const rollout = rollouts.find((item) => item.cwd === cwd && !used.has(item.id))
        if (rollout) used.add(rollout.id)
        const id = rollout?.id ?? `pid-${process.pid}-${process.startedAtMs}`
        const tail = rollout ? await io.readTail(rollout.path) : null
        const state =
          tail !== null
            ? parseCodexActivity(tail)
            : {
                activity: 'idle' as const,
                attention: 'none' as const,
                updatedAtMs: process.startedAtMs
              }
        const usage = (tail !== null ? parseCodexUsage(tail) : null) ?? known.get(id) ?? null
        if (usage) known.set(id, usage)
        live.add(id)
        const project = await resolveProject(cwd, io)
        sessions.push({
          key: `codex:${id}`,
          provider: 'codex',
          sessionId: id,
          pid: process.pid,
          name: basename(cwd),
          cwd,
          projectKey: projectKey(project.root),
          projectLabel: basename(project.root),
          projectRoot: project.root,
          companyKey: projectKey(dirname(project.root)),
          companyLabel: basename(dirname(project.root)),
          worktree: project.worktree,
          host: 'terminal',
          orcaPaneKey: null,
          ...state,
          currentTool: null,
          subagents: [],
          startedAtMs: process.startedAtMs,
          usage,
          ...(rollout?.startedAtMs != null && { threadStartedAtMs: rollout.startedAtMs }),
          accountKey: rollout?.accountKey ?? null,
          // A rollout names its own account, so nothing is inferred from who is signed in.
          ...(rollout?.accountKey && { accountConfidence: 'exact' as const })
        })
        health.detail = 'live'
      } catch {
        health.ok = false
        health.detail = 'process read failed'
      }
    }
    for (const id of known.keys()) if (!live.has(id)) known.delete(id)
  } catch {
    health.ok = false
    health.detail = 'discovery failed'
  }
  return { sessions, sources: [health] }
}
