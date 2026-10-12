import { basename } from 'node:path'
import type {
  AgentActivity,
  AgentAttention,
  CurrentTool,
  SessionRef,
  SessionUsage,
  SourceHealth
} from '../shared/office/types'
import { type CodexTotal, codexTotalOf } from '../shared/accounts'
import { type BridgeIo, isLabel, isMissing, jsonObject, object } from './io'
import { placementOf, resolveProject } from './project-root'
import { findRollouts, type Rollout } from './codex-rollouts'
import { parseCodexUsage } from './codex-usage'
import { toolActivity, toolCategory } from './tool-category'
import {
  isInsideAppBundle,
  type ProcessRow,
  readProcessTable,
  readWorkingFolder
} from './process-table'

// A Codex app-server: the host of desktop, IDE and plugin threads.
export function isAppServer({ argv }: ProcessRow): boolean {
  return basename(argv[0]) === 'codex' && argv.slice(1).some((arg) => arg === 'app-server')
}

export function codexProcesses(rows: ProcessRow[]): { pid: number; startedAtMs: number }[] {
  return rows
    .filter(({ argv }) => {
      if (basename(argv[0]) !== 'codex') return false
      const sessionCommand = argv.findIndex((arg) => /^(exec|e|resume|fork)$/.test(arg))
      // An exec prompt may mention a helper; only command arguments precede it.
      const commandArgs = argv.slice(1, sessionCommand < 0 ? undefined : sessionCommand)
      return !commandArgs.some((arg) =>
        /^(app-server|exec-server|mcp-server|sandbox|helper)(?:$|-)/.test(arg)
      )
    })
    .map(({ pid, startedAtMs }) => ({ pid, startedAtMs }))
}

export function parseCodexActivity(tail: string): {
  activity: AgentActivity
  attention: AgentAttention
  updatedAtMs: number
  currentTool: CurrentTool | null
} {
  let activity: AgentActivity = 'idle'
  let attention: AgentAttention = 'none'
  let updatedAtMs = 0
  const openCalls = new Map<string, CurrentTool>()
  for (const line of tail.split('\n')) {
    const record = jsonObject(line)
    if (record?.type !== 'event_msg' && record?.type !== 'response_item') continue
    const payload = object(record.payload)
    const type = payload?.type
    const callId = payload?.call_id ?? payload?.id
    if (type === 'function_call' || type === 'custom_tool_call' || type === 'local_shell_call') {
      const name = isLabel(payload?.name)
        ? payload.name
        : type === 'local_shell_call'
          ? 'exec_command'
          : 'unknown'
      openCalls.set(typeof callId === 'string' ? callId : 'unknown', {
        name,
        category: toolCategory(name)
      })
      activity = 'running'
    } else if (
      type === 'function_call_output' ||
      type === 'custom_tool_call_output' ||
      type === 'local_shell_call_output'
    ) {
      // Outputs close their own call, not another tool still running in parallel.
      openCalls.delete(typeof callId === 'string' ? callId : 'unknown')
      activity = 'thinking'
    } else if (
      type === 'reasoning' ||
      type === 'agent_reasoning' ||
      type === 'agent_message' ||
      (type === 'message' && payload?.role === 'assistant') ||
      type === 'task_started'
    )
      activity = 'thinking'
    else if (type === 'task_complete' || type === 'turn_aborted') {
      openCalls.clear()
      activity = 'idle'
    } else continue
    attention = type === 'task_complete' ? 'done' : 'none'
    const timestamp = typeof record.timestamp === 'string' ? Date.parse(record.timestamp) : 0
    updatedAtMs = Number.isFinite(timestamp) ? timestamp : 0
  }
  const currentTool = [...openCalls.values()].at(-1) ?? null
  return {
    activity: currentTool ? toolActivity(currentTool.category) : activity,
    attention,
    updatedAtMs,
    currentTool
  }
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
      // The session last shown for this rollout: what its final total is filed under.
      session: SessionRef | null
    }
  >
}
const remembered = new WeakMap<BridgeIo, Remembered>()
const NEXT_STEP_MS = 60_000
// A hosted thread has no process of its own: quiet this long, it has finished.
const HOSTED_FRESH_MS = 120_000

export interface CodexBatch {
  sessions: SessionRef[]
  // The total each rollout ended on, for the sessions that left since the last look: one may
  // have finished a turn after the last look that found its process.
  departed: CodexTotal[]
  sources: SourceHealth[]
}

export async function collectCodex(
  root: string,
  io: BridgeIo,
  readProcesses = (): Promise<ProcessRow[]> => readProcessTable(io),
  derivesAccounts = false,
  now = Date.now()
): Promise<CodexBatch> {
  const sessions: SessionRef[] = []
  const departed: CodexTotal[] = []
  const health: SourceHealth = { id: 'codex', ok: true, detail: 'empty' }
  let memory = remembered.get(io)
  if (!memory) {
    remembered.set(io, (memory = { usage: new Map(), folders: new Map(), tails: new Map() }))
  }
  const { usage: known, folders, tails } = memory
  const live = new Set<string>()
  const liveTails = new Set<string>()
  try {
    const rows = await readProcesses()
    const processes = codexProcesses(rows)
    const isHosting = rows.some(isAppServer)
    const rollouts =
      processes.length || isHosting ? await findRollouts(root, io, derivesAccounts) : []
    const used = new Set<string>()
    // One session per rollout: its activity and usage from the tail, its place from `cwd`.
    const show = async (
      rollout: Rollout | undefined,
      cwd: string,
      owner: { pid: number | null; startedAtMs: number }
    ): Promise<void> => {
      const id = rollout?.id ?? `pid-${owner.pid}-${owner.startedAtMs}`
      let tail = rollout ? tails.get(rollout.path) : undefined
      // The walk over rollouts has just read each file's size and time: an unchanged tail is
      // not read or parsed again.
      if (rollout && (tail?.mtimeMs !== rollout.mtimeMs || tail.size !== rollout.size)) {
        const text = await io.readTail(rollout.path)
        tail = {
          mtimeMs: rollout.mtimeMs,
          size: rollout.size,
          state: parseCodexActivity(text),
          usage: parseCodexUsage(text),
          session: null
        }
        tails.set(rollout.path, tail)
      }
      if (rollout) liveTails.add(rollout.path)
      const state = tail
        ? tail.state
        : {
            activity: 'idle' as const,
            attention: 'none' as const,
            updatedAtMs: owner.startedAtMs,
            currentTool: null
          }
      // Cached assistant output must age out even when no new bytes arrive.
      const activity =
        state.activity === 'thinking' &&
        state.updatedAtMs > 0 &&
        now - state.updatedAtMs >= NEXT_STEP_MS
          ? 'idle'
          : state.activity
      const usage = tail?.usage ?? known.get(id) ?? null
      if (usage) known.set(id, usage)
      live.add(id)
      const project = await resolveProject(cwd, io, now)
      const session: SessionRef = {
        key: `codex:${id}`,
        provider: 'codex',
        sessionId: id,
        pid: owner.pid,
        name: basename(cwd),
        cwd,
        ...placementOf(project),
        host: 'terminal',
        orcaPaneKey: null,
        ...state,
        activity,
        subagents: [],
        startedAtMs: owner.startedAtMs,
        usage,
        ...(rollout?.startedAtMs != null && { threadStartedAtMs: rollout.startedAtMs }),
        accountKey: rollout?.accountKey ?? null,
        // A rollout names its own account, so nothing is inferred from who is signed in.
        ...(rollout?.accountKey && { accountConfidence: 'exact' as const })
      }
      sessions.push(session)
      if (tail) tail.session = session
      health.detail = 'live'
    }
    for (const process of processes) {
      try {
        const identity = `${process.pid}:${process.startedAtMs}`
        let cwd = folders.get(identity)
        if (!cwd) {
          cwd = await readWorkingFolder(io, process.pid)
          if (cwd) folders.set(identity, cwd)
        }
        if (!cwd || isInsideAppBundle(cwd)) continue
        const rollout = rollouts.find((item) => item.cwd === cwd && !used.has(item.id))
        if (rollout) used.add(rollout.id)
        await show(rollout, cwd, process)
      } catch {
        health.ok = false
        health.detail = 'process read failed'
      }
    }
    // The desktop app, the IDE extension and plugins run their threads inside an app-server,
    // which no process maps to: a thread is live while its rollout is being written.
    if (isHosting)
      for (const rollout of rollouts) {
        const age = now - rollout.mtimeMs
        if (used.has(rollout.id) || age < 0 || age >= HOSTED_FRESH_MS) continue
        if (isInsideAppBundle(rollout.cwd)) continue
        used.add(rollout.id)
        try {
          await show(rollout, rollout.cwd, {
            pid: null,
            startedAtMs: rollout.startedAtMs ?? rollout.mtimeMs
          })
        } catch {
          health.ok = false
          health.detail = 'rollout read failed'
        }
      }
    for (const id of known.keys()) if (!live.has(id)) known.delete(id)
    const running = new Set(processes.map((process) => `${process.pid}:${process.startedAtMs}`))
    for (const identity of folders.keys()) if (!running.has(identity)) folders.delete(identity)
    for (const [path, { session }] of tails) {
      if (liveTails.has(path)) continue
      tails.delete(path)
      try {
        // Its last turn may have been written after the last look that found its process.
        const usage = session && parseCodexUsage(await io.readTail(path))
        const total = usage && codexTotalOf({ ...session, usage })
        if (total) departed.push(total)
      } catch (error) {
        if (isMissing(error)) continue
        health.ok = false
        health.detail = 'rollout read failed'
      }
    }
  } catch {
    health.ok = false
    health.detail = 'discovery failed'
  }
  return { sessions, departed, sources: [health] }
}
