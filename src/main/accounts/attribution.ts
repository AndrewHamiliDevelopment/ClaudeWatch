import { createHash } from 'crypto'
import { isAccountKey } from '../../bridge/account-key'
import { object } from '../../bridge/io'
import { zeroCounts } from '../../shared/office/token-counts'
import { type CodexTotal, type UsageDelta, USAGE_RETENTION_MS } from '../../shared/accounts'
import type { TokenCounts } from '../../shared/office/types'
import { upsertAccount, upsertClaudeAccount } from './account-records'
import { isAmount, isPosition, toCounts } from './amount'
import type { IdentityRead } from './identity'
import {
  addUsage,
  BEYOND_ANY_LINE,
  dayKey,
  FOLDED_DAY,
  type LedgerState,
  type TranscriptPlace,
  weekStartKey
} from './ledger-state'

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
    const counts = toCounts(delta?.counts)
    if (!delta || !counts || !isAmount(delta.atMs) || !isPosition(delta.position)) return []
    const { sessionKey, projectKey, projectLabel, file, atMs, position } = delta
    if (!isLabel(sessionKey) || !isLabel(projectKey) || !isLabel(projectLabel) || !isLabel(file))
      return []
    return [{ sessionKey, projectKey, projectLabel, file, atMs, position, counts }]
  })
}

// Codex totals posted beside the feed, checked the same way.
export function toCodexTotals(message: unknown): CodexTotal[] {
  const usage = object(message)
  if (usage?.type !== 'codex-usage' || usage.v !== 1 || !Array.isArray(usage.totals)) return []
  return usage.totals.flatMap((value): CodexTotal[] => {
    const total = object(value)
    const counts = toCounts(total?.counts)
    if (!total || !counts) return []
    const { sessionKey, projectKey, projectLabel, accountKey, threadStartedAtMs } = total
    if (!isLabel(sessionKey) || !sessionKey.startsWith('codex:')) return []
    if (!isLabel(projectKey) || !isLabel(projectLabel)) return []
    if (accountKey !== null && !isAccountKey(accountKey)) return []
    if (threadStartedAtMs !== null && !isAmount(threadStartedAtMs)) return []
    return [{ sessionKey, projectKey, projectLabel, accountKey, threadStartedAtMs, counts }]
  })
}

const transcriptId = (file: string): string =>
  createHash('sha256').update(file).digest('base64url').slice(0, 16)

// Files each line under the account signed in when it was written. The bridge reports a
// transcript again from its first line whenever it re-reads it, so a line counts only if it
// starts beyond the furthest one counted from the same file, or is newer than the latest: a
// line appended in the millisecond of the last has only its place to show it is new, a
// rewritten transcript only its time. True when anything was added.
export function countUsage(state: LedgerState, deltas: UsageDelta[], now: number): boolean {
  const floor = Math.max(state.trackingSinceMs, now - USAGE_RETENTION_MS)
  // Where each file stood before this batch: lines of one millisecond that no position tells
  // apart still count when they arrive together. A file never counted has the floor alone.
  const countedUpTo = new Map<string, TranscriptPlace & { id: string }>()
  let hasAdded = false
  for (const delta of deltas) {
    let place = countedUpTo.get(delta.file)
    if (!place) {
      const id = transcriptId(delta.file)
      place = { id, ...(state.files.get(id) ?? { atMs: floor, position: BEYOND_ANY_LINE }) }
      countedUpTo.set(delta.file, place)
    }
    const isNew = delta.position > place.position || delta.atMs > place.atMs
    // The floor holds wherever the line starts: nothing from before tracking is ever counted.
    if (!isNew || delta.atMs <= floor) continue
    const accountKey = accountAt(state, delta.atMs)
    addUsage(state, {
      accountKey,
      day: dayKey(delta.atMs),
      projectKey: delta.projectKey,
      confidence: accountKey ? 'inferred' : 'unattributed',
      counts: delta.counts
    })
    state.projects.set(delta.projectKey, delta.projectLabel)
    const counted = state.files.get(place.id)
    state.files.set(place.id, {
      atMs: Math.max(counted?.atMs ?? 0, delta.atMs),
      position: Math.max(counted?.position ?? 0, delta.position)
    })
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
  sessions: readonly CodexTotal[],
  now: number
): boolean {
  let hasChanged = false
  // A thread begun before this could hold tokens the ledger never saw being spent.
  const watchedSinceMs = Math.max(state.trackingSinceMs, now - CODEX_RETENTION_MS)
  for (const session of sessions) {
    const total = session.counts
    // By the thread's own age, not its process's: a resumed thread runs in a new process and
    // still carries its whole history. One of unknown age starts from what it already spent.
    const isWholeThreadWatched = (session.threadStartedAtMs ?? -Infinity) >= watchedSinceMs
    const counted =
      state.codexSessions.get(session.sessionKey)?.counts ??
      (isWholeThreadWatched ? zeroCounts() : total)
    const added = pairwise(total, counted, (current, before) => Math.max(0, current - before))
    const hasGrown = Object.values(added).some((amount) => amount > 0)
    if (!hasGrown && state.codexSessions.has(session.sessionKey)) continue
    state.codexSessions.set(session.sessionKey, {
      counts: pairwise(total, counted, Math.max),
      countedAtMs: now
    })
    hasChanged = true
    if (!hasGrown) continue
    const { accountKey } = session
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
  for (const [id, { atMs }] of state.files) {
    if (atMs < now - USAGE_RETENTION_MS) state.files.delete(id)
  }
  for (const [key, { countedAtMs }] of state.codexSessions) {
    if (countedAtMs < now - CODEX_RETENTION_MS) state.codexSessions.delete(key)
  }
  state.spans = state.spans.filter(({ toMs }) => toMs === null || toMs >= now - USAGE_RETENTION_MS)
  // The view shows today, its week and the total since tracking began, so days before the week
  // are kept as one bucket per account, project and confidence and the file stops growing daily.
  const weekStart = weekStartKey(now)
  for (const [id, bucket] of state.buckets) {
    if (bucket.day >= weekStart || bucket.day === FOLDED_DAY) continue
    state.buckets.delete(id)
    addUsage(state, { ...bucket, day: FOLDED_DAY })
  }
}
