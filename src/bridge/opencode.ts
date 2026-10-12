import { basename, join } from 'node:path'
import type { SessionRef, SourceHealth, SubagentRef, TokenCounts } from '../shared/office/types'
import { zeroCounts } from '../shared/office/token-counts'
import { type BridgeIo, displayName, isLabel } from './io'
import {
  OPENCODE_IDLE,
  opencodeProcesses,
  opencodeState,
  type OpencodeState
} from './opencode-activity'
import {
  OpencodeDbError,
  type OpencodeFailure,
  type OpencodeQuery,
  type OpencodeRow
} from './opencode-db'
import {
  forgetExited,
  isInsideAppBundle,
  keyOf,
  newestFirst,
  type ProcessRow,
  readProcessTable,
  rememberedFolder
} from './process-table'
import { placementOf, resolveProject } from './project-root'
import { isStillWorking, OPEN_TOOL_HOLD_MS, quietFor, SUBAGENT_FRESH_MS } from './liveness'
import { toolActivity } from './tool-category'
import { tokenCount } from './usage-fold'

const FAILURE_DETAIL: Record<OpencodeFailure, string> = {
  missing: 'OpenCode is running but its database was not found',
  busy: 'OpenCode database is busy',
  changed: 'OpenCode database has a shape this version cannot read',
  unreadable: 'OpenCode database could not be read',
  malformed: 'OpenCode session data could not be read'
}
const SESSION_ID = /^[\w-]{1,128}$/

// Input excludes what was read from or written to the cache, and output excludes reasoning:
// the five columns add up to the session's total.
function countsOf(row: OpencodeRow): TokenCounts {
  return {
    input: tokenCount(row.tokens_input),
    output: tokenCount(row.tokens_output) + tokenCount(row.tokens_reasoning),
    cacheWrite: tokenCount(row.tokens_cache_write),
    cacheRead: tokenCount(row.tokens_cache_read)
  }
}

interface SessionRow {
  id: string
  title: string
  createdAtMs: number | null
  updatedAtMs: number
  counts: TokenCounts
}
// A row of the wrong shape is no session at all.
function sessionRow(row: OpencodeRow): SessionRow | null {
  if (typeof row.id !== 'string' || !SESSION_ID.test(row.id)) return null
  if (typeof row.time_updated !== 'number') return null
  return {
    id: row.id,
    title: typeof row.title === 'string' ? displayName(row.title) : '',
    createdAtMs: typeof row.time_created === 'number' ? row.time_created : null,
    updatedAtMs: row.time_updated,
    counts: countsOf(row)
  }
}

// What a session's newest message says it is doing.
function stateOf(query: OpencodeQuery, sessionId: string, now: number): OpencodeState {
  const [message] = query('newestMessage', sessionId)
  const parts = typeof message?.id === 'string' ? query('messageParts', message.id, sessionId) : []
  return opencodeState(message, parts, now)
}

// A child session written within the last minute is an agent still at work. Its row is written
// as a step ends, not while a tool runs, so a quiet one is held while its newest tool is open.
function subagentOf(query: OpencodeQuery, row: OpencodeRow, now: number): SubagentRef | null {
  if (typeof row.id !== 'string' || !SESSION_ID.test(row.id)) return null
  if (typeof row.time_updated !== 'number') return null
  const quietMs = quietFor(now, row.time_updated)
  if (quietMs === null || quietMs >= OPEN_TOOL_HOLD_MS) return null
  const tool = quietMs < SUBAGENT_FRESH_MS ? null : stateOf(query, row.id, now).currentTool
  if (!isStillWorking(quietMs, SUBAGENT_FRESH_MS, tool !== null)) return null
  return {
    id: row.id,
    type: isLabel(row.agent) ? row.agent : 'subagent',
    activity: tool ? toolActivity(tool.category) : 'thinking',
    tokens: countsOf(row)
  }
}

interface Conversation {
  session: SessionRow
  state: OpencodeState
  subagents: SubagentRef[]
}
type AgentProcess = ReturnType<typeof opencodeProcesses>[number] & { cwd: string }

// The newest session in the process's folder that it can have written: one last touched before
// the process began belongs to an earlier run, and its name and tokens are not this agent's.
function readConversation(
  query: OpencodeQuery,
  process: AgentProcess,
  taken: Set<string>,
  now: number
): Conversation | null {
  const session = query('rootSessions', process.cwd)
    .flatMap((row) => sessionRow(row) ?? [])
    .find(({ id, updatedAtMs }) => updatedAtMs >= process.startedAtMs && !taken.has(id))
  if (!session) return null
  taken.add(session.id)
  return {
    session,
    state: stateOf(query, session.id, now),
    subagents: query('childSessions', session.id).flatMap(
      (row) => subagentOf(query, row, now) ?? []
    )
  }
}

// Where each live process runs, and the placeholder key each was first shown under, by pid and
// start time.
const folders = new WeakMap<BridgeIo, Map<string, string>>()
const placeholders = new WeakMap<BridgeIo, Map<string, string>>()

// The OpenCode processes that are the owner's agents, each with the folder it runs in.
async function locate(
  io: BridgeIo,
  processes: ReturnType<typeof opencodeProcesses>,
  health: SourceHealth
): Promise<AgentProcess[]> {
  let known = folders.get(io)
  if (!known) folders.set(io, (known = new Map()))
  const running: AgentProcess[] = []
  for (const process of processes) {
    try {
      const cwd = await rememberedFolder(io, known, process)
      if (cwd && !isInsideAppBundle(cwd)) running.push({ ...process, cwd })
    } catch {
      // It may have exited since the table was read: the others are still shown.
      health.ok = false
      health.detail = 'OpenCode process read failed'
    }
  }
  forgetExited(known, processes)
  return running
}

interface OpencodeBatch {
  sessions: SessionRef[]
  sources: SourceHealth[]
}

// `root` is OpenCode's data folder. Nothing in it is opened unless an OpenCode process runs.
export async function collectOpencode(
  root: string,
  io: BridgeIo,
  readProcesses = (): Promise<ProcessRow[]> => readProcessTable(io),
  now = Date.now()
): Promise<OpencodeBatch> {
  const health: SourceHealth = { id: 'opencode', ok: true, detail: 'empty' }
  try {
    const processes = opencodeProcesses(await readProcesses())
    let keys = placeholders.get(io)
    if (!keys) placeholders.set(io, (keys = new Map()))
    forgetExited(keys, processes)
    const running = newestFirst(await locate(io, processes, health))
    if (!running.length) return { sessions: [], sources: [health] }

    const taken = new Set<string>()
    const conversations = await io.readOpencode(join(root, 'opencode.db'), (query) =>
      running.map((process) => {
        try {
          return { process, conversation: readConversation(query, process, taken, now) }
        } catch (error) {
          // One session's bad JSON costs that session; anything else is the whole database's.
          if (!(error instanceof OpencodeDbError) || error.reason !== 'malformed') throw error
          health.ok = false
          health.detail = FAILURE_DETAIL.malformed
          return null
        }
      })
    )
    const sessions: SessionRef[] = []
    for (const found of conversations) {
      if (!found) continue
      const project = await resolveProject(found.process.cwd, io, now)
      const key = keyOf(keys, found.process, 'opencode', found.conversation?.session.id)
      sessions.push(sessionOf(found.process, found.conversation, key, placementOf(project)))
    }
    if (health.ok) health.detail = 'live'
    return { sessions, sources: [health] }
  } catch (error) {
    health.ok = false
    health.detail =
      error instanceof OpencodeDbError ? FAILURE_DETAIL[error.reason] : 'OpenCode discovery failed'
    return { sessions: [], sources: [health] }
  }
}

function sessionOf(
  process: AgentProcess,
  conversation: Conversation | null,
  key: string,
  placement: ReturnType<typeof placementOf>
): SessionRef {
  const session = conversation?.session
  // A process that has not written a session yet is still an agent at its desk.
  const id = session?.id ?? `pid-${process.pid}-${process.startedAtMs}`
  return {
    key,
    provider: 'opencode',
    sessionId: id,
    pid: process.pid,
    name: session?.title || displayName(basename(process.cwd)),
    cwd: process.cwd,
    ...placement,
    host: 'terminal',
    orcaPaneKey: null,
    ...(conversation?.state ?? OPENCODE_IDLE),
    subagents: conversation?.subagents ?? [],
    startedAtMs: process.startedAtMs,
    updatedAtMs: session?.updatedAtMs ?? process.startedAtMs,
    // Running totals for the session, as Codex reports its own. Children keep their own rows.
    usage: session
      ? {
          own: session.counts,
          subagents: zeroCounts(),
          spawned: 0,
          contextTokens: null,
          contextLimit: null
        }
      : null,
    ...(session?.createdAtMs != null && { threadStartedAtMs: session.createdAtMs }),
    // OpenCode's accounts are never read, so its tokens are filed under no account.
    accountKey: null
  }
}
