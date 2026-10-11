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

interface Remembered {
  // The usage last read from each live rollout, by session id. A long tool output pushes the
  // newest `token_count` out of the 64 KB tail, and its total still stands until the next one.
  usage: Map<string, SessionUsage>
  // Where each live process runs, by pid and start time: asking costs an `lsof` run.
  folders: Map<string, string>
  // What each live rollout's tail held, by path, with the size and time of the file it was read from.
  tails: Map<
    string,
    {
      mtimeMs: number
      size: number
      state: ReturnType<typeof parseCodexActivity>
      usage: SessionUsage | null
    }
  >
}
const remembered = new WeakMap<BridgeIo, Remembered>()

export async function collectCodex(
  root: string,
  io: BridgeIo,
  readProcesses = (): Promise<ProcessRow[]> => readProcessTable(io),
  derivesAccounts = false,
  now = Date.now()
): Promise<{ sessions: SessionRef[]; sources: SourceHealth[] }> {
  const sessions: SessionRef[] = []
  const health: SourceHealth = { id: 'codex', ok: true, detail: 'empty' }
  let memory = remembered.get(io)
  if (!memory) {
    remembered.set(io, (memory = { usage: new Map(), folders: new Map(), tails: new Map() }))
  }
  const { usage: known, folders, tails } = memory
  const live = new Set<string>()
  const liveTails = new Set<string>()
  try {
    const processes = codexProcesses(await readProcesses())
    const rollouts = processes.length ? await findRollouts(root, io, derivesAccounts) : []
    const used = new Set<string>()
    for (const process of processes) {
      try {
        const identity = `${process.pid}:${process.startedAtMs}`
        let cwd = folders.get(identity)
        if (!cwd) {
          const cwdOutput = await io.exec('/usr/sbin/lsof', [
            '-a',
            '-p',
            String(process.pid),
            '-d',
            'cwd',
            '-Fn'
          ])
          cwd = cwdOutput
            .split('\n')
            .find((line) => line.startsWith('n/'))
            ?.slice(1)
          if (cwd) folders.set(identity, cwd)
        }
        // Codex bundled in an app (ChatGPT, Orca helpers) runs from inside the bundle; not a session.
        if (!cwd || /\.app\/Contents(\/|$)/.test(cwd)) continue
        const rollout = rollouts.find((item) => item.cwd === cwd && !used.has(item.id))
        if (rollout) used.add(rollout.id)
        const id = rollout?.id ?? `pid-${process.pid}-${process.startedAtMs}`
        let tail = rollout ? tails.get(rollout.path) : undefined
        // The walk over rollouts has just read each file's size and time: an unchanged tail is
        // not read or parsed again.
        if (rollout && (tail?.mtimeMs !== rollout.mtimeMs || tail.size !== rollout.size)) {
          const text = await io.readTail(rollout.path)
          tail = {
            mtimeMs: rollout.mtimeMs,
            size: rollout.size,
            state: parseCodexActivity(text),
            usage: parseCodexUsage(text)
          }
          tails.set(rollout.path, tail)
        }
        if (rollout) liveTails.add(rollout.path)
        const state = tail
          ? tail.state
          : {
              activity: 'idle' as const,
              attention: 'none' as const,
              updatedAtMs: process.startedAtMs
            }
        const usage = tail?.usage ?? known.get(id) ?? null
        if (usage) known.set(id, usage)
        live.add(id)
        const project = await resolveProject(cwd, io, now)
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
    const running = new Set(processes.map((process) => `${process.pid}:${process.startedAtMs}`))
    for (const identity of folders.keys()) if (!running.has(identity)) folders.delete(identity)
    for (const path of tails.keys()) if (!liveTails.has(path)) tails.delete(path)
  } catch {
    health.ok = false
    health.detail = 'discovery failed'
  }
  return { sessions, sources: [health] }
}
