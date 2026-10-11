import { createHash } from 'crypto'
import { object } from '../../bridge/io'
import { zeroCounts } from '../../bridge/usage-fold'
import type { UsageDelta } from '../../shared/accounts'
import type { SessionRef, TokenCounts } from '../../shared/office/types'
import { upsertAccount, upsertClaudeAccount } from './account-records'
import { isAmount } from './amount'
import type { IdentityRead } from './identity'
import { addUsage, dayKey, type LedgerState, RETENTION_MS } from './ledger-state'

// Samples closer together than this were taken by one unbroken watch, so a change between
// them happened then. Further apart, nobody saw when it happened.
const WATCH_GAP_MS = 60_000

// Notes who is signed in on the shared login. Sessions there carry no account, so this
// timeline is the only way to say whose tokens a transcript line spent.
export function recordIdentity(state: LedgerState, read: IdentityRead, now: number): void {
  if (read.status === 'unreadable') return
  const accountKey =
    read.status === 'signed-in'
      ? upsertClaudeAccount(state, read.identity, 'default-login', now).key
      : null
  const last = state.spans.at(-1)
  const open = last?.toMs === null ? last : null
  if (open && open.accountKey !== accountKey) {
    const wasWatching = state.sampledAtMs !== null && now - state.sampledAtMs <= WATCH_GAP_MS
    // After a gap the old account is only known up to the last look; what follows is unknown.
    open.toMs = wasWatching ? now : (state.sampledAtMs ?? now)
  }
  if (accountKey && open?.accountKey !== accountKey) {
    state.spans.push({ accountKey, fromMs: now, toMs: null })
  }
  state.sampledAtMs = now
}

function accountAt(state: LedgerState, atMs: number): string | null {
  const span = state.spans.findLast(
    ({ fromMs, toMs }) => fromMs <= atMs && (toMs === null || atMs < toMs)
  )
  return span?.accountKey ?? null
}

const isLabel = (value: unknown): value is string => typeof value === 'string' && value.length > 0

// The bridge is another process: what it posts is checked before any of it is counted.
export function toUsageDeltas(message: unknown): UsageDelta[] {
  const usage = object(message)
  if (usage?.type !== 'usage' || usage.v !== 1 || !Array.isArray(usage.deltas)) return []
  return usage.deltas.flatMap((value): UsageDelta[] => {
    const delta = object(value)
    const counts = object(delta?.counts)
    if (!delta || !counts || !isAmount(delta.atMs)) return []
    const { sessionKey, projectKey, projectLabel, file, atMs } = delta
    const { input, output, cacheWrite, cacheRead } = counts
    if (!isLabel(sessionKey) || !isLabel(projectKey) || !isLabel(projectLabel) || !isLabel(file))
      return []
    if (!isAmount(input) || !isAmount(output) || !isAmount(cacheWrite) || !isAmount(cacheRead))
      return []
    return [
      {
        sessionKey,
        projectKey,
        projectLabel,
        file,
        atMs,
        counts: { input, output, cacheWrite, cacheRead }
      }
    ]
  })
}

const transcriptId = (file: string): string =>
  createHash('sha256').update(file).digest('base64url').slice(0, 16)

// Files each line under the account signed in when it was written. The bridge reports a
// transcript again from its first line whenever it re-reads it, so a line counts only if it is
// newer than the last one counted from the same file. True when anything was added.
export function countUsage(state: LedgerState, deltas: UsageDelta[], now: number): boolean {
  const floor = Math.max(state.trackingSinceMs, now - RETENTION_MS)
  // Where each file stood before this batch: lines that share a timestamp arrive together.
  const countedUpTo = new Map<string, { id: string; atMs: number }>()
  let hasAdded = false
  for (const delta of deltas) {
    let place = countedUpTo.get(delta.file)
    if (!place) {
      const id = transcriptId(delta.file)
      place = { id, atMs: state.files.get(id) ?? floor }
      countedUpTo.set(delta.file, place)
    }
    if (delta.atMs <= place.atMs) continue
    const accountKey = accountAt(state, delta.atMs)
    addUsage(state, {
      accountKey,
      day: dayKey(delta.atMs),
      projectKey: delta.projectKey,
      confidence: accountKey ? 'inferred' : 'unattributed',
      counts: delta.counts
    })
    state.projects.set(delta.projectKey, delta.projectLabel)
    state.files.set(place.id, Math.max(state.files.get(place.id) ?? 0, delta.atMs))
    hasAdded = true
  }
  return hasAdded
}

const pairwise = (
  a: TokenCounts,
  b: TokenCounts,
  combine: (x: number, y: number) => number
): TokenCounts => ({
  input: combine(a.input, b.input),
  output: combine(a.output, b.output),
  cacheWrite: combine(a.cacheWrite, b.cacheWrite),
  cacheRead: combine(a.cacheRead, b.cacheRead)
})

// A Codex session can be resumed long after it went quiet, and forgetting its total would
// count the whole of it again.
const CODEX_RETENTION_MS = 30 * 24 * 60 * 60 * 1000

// A Codex session names its account and keeps one running total, so its growth since the
// highest total already counted goes to that account, exactly. True when the ledger changed.
export function countCodexSessions(
  state: LedgerState,
  sessions: readonly SessionRef[],
  now: number
): boolean {
  let hasChanged = false
  // A thread begun before this could hold tokens the ledger never saw being spent.
  const watchedSinceMs = Math.max(state.trackingSinceMs, now - CODEX_RETENTION_MS)
  for (const session of sessions) {
    if (session.provider !== 'codex' || !session.usage) continue
    const total = session.usage.own
    // By the thread's own age, not its process's: a resumed thread runs in a new process and
    // still carries its whole history. One of unknown age starts from what it already spent.
    const isWholeThreadWatched = (session.threadStartedAtMs ?? -Infinity) >= watchedSinceMs
    const counted =
      state.codexSessions.get(session.key)?.counts ?? (isWholeThreadWatched ? zeroCounts() : total)
    const added = pairwise(total, counted, (current, before) => Math.max(0, current - before))
    const hasGrown = Object.values(added).some((amount) => amount > 0)
    if (!hasGrown && state.codexSessions.has(session.key)) continue
    state.codexSessions.set(session.key, {
      counts: pairwise(total, counted, Math.max),
      countedAtMs: now
    })
    hasChanged = true
    if (!hasGrown) continue
    const accountKey = session.accountKey ?? null
    if (accountKey)
      upsertAccount(state, { key: accountKey, provider: 'codex' }, 'codex-rollout', now)
    addUsage(state, {
      accountKey,
      day: dayKey(now),
      projectKey: session.projectKey,
      confidence: accountKey ? 'exact' : 'unattributed',
      counts: added
    })
    state.projects.set(session.projectKey, session.projectLabel)
  }
  return hasChanged
}

export function prune(state: LedgerState, now: number): void {
  for (const [id, atMs] of state.files) {
    if (atMs < now - RETENTION_MS) state.files.delete(id)
  }
  for (const [key, { countedAtMs }] of state.codexSessions) {
    if (countedAtMs < now - CODEX_RETENTION_MS) state.codexSessions.delete(key)
  }
  state.spans = state.spans.filter(({ toMs }) => toMs === null || toMs >= now - RETENTION_MS)
}
