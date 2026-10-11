import { object } from '../../bridge/io'
import type { AccountLimit, AccountSource } from '../../shared/accounts'
import type { AccountConfidence, ProviderId, TokenCounts } from '../../shared/office/types'
import {
  type AccountRecord,
  bucketId,
  type IdentitySpan,
  type LedgerState,
  type UsageBucket
} from './ledger-state'

const VERSION = 1
const MAX_TEXT_LENGTH = 512

const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
const isText = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= MAX_TEXT_LENGTH
const isOneOf =
  <Option extends string>(options: readonly Option[]) =>
  (value: unknown): value is Option =>
    options.some((option) => option === value)
const isProvider = isOneOf<ProviderId>(['claude', 'codex'])
const isSource = isOneOf<AccountSource>(['default-login', 'orca', 'codex-rollout'])
const isConfidence = isOneOf<AccountConfidence>(['exact', 'inferred', 'unattributed'])

const textOrNull = (value: unknown): string | null => (isText(value) ? value : null)
const amountOrNull = (value: unknown): number | null => (isAmount(value) ? value : null)
const items = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
// A stored map is a list of [key, value] pairs with a text key.
const pairs = (value: unknown): [string, unknown][] =>
  items(value).flatMap((pair): [string, unknown][] =>
    Array.isArray(pair) && pair.length === 2 && isText(pair[0]) ? [[pair[0], pair[1]]] : []
  )

function toCounts(value: unknown): TokenCounts | null {
  const counts = object(value)
  if (!counts) return null
  const { input, output, cacheWrite, cacheRead } = counts
  return isAmount(input) && isAmount(output) && isAmount(cacheWrite) && isAmount(cacheRead)
    ? { input, output, cacheWrite, cacheRead }
    : null
}

function toAccount(value: unknown): AccountRecord[] {
  const account = object(value)
  if (!account || !isText(account.key) || !isProvider(account.provider)) return []
  if (!isAmount(account.firstSeenMs)) return []
  return [
    {
      key: account.key,
      provider: account.provider,
      email: textOrNull(account.email),
      organizationUuid: textOrNull(account.organizationUuid),
      organizationName: textOrNull(account.organizationName),
      plan: textOrNull(account.plan),
      alias: textOrNull(account.alias),
      orcaAccountId: textOrNull(account.orcaAccountId),
      sources: items(account.sources).filter(isSource),
      firstSeenMs: account.firstSeenMs
    }
  ]
}

function toSpan(value: unknown): IdentitySpan[] {
  const span = object(value)
  if (!span || !isText(span.accountKey) || !isAmount(span.fromMs)) return []
  if (span.toMs !== null && !isAmount(span.toMs)) return []
  return [{ accountKey: span.accountKey, fromMs: span.fromMs, toMs: span.toMs }]
}

function toBucket(value: unknown): UsageBucket[] {
  const bucket = object(value)
  const counts = toCounts(bucket?.counts)
  if (!bucket || !counts || !isConfidence(bucket.confidence) || !isText(bucket.projectKey))
    return []
  if (!isText(bucket.day) || !/^\d{4}-\d{2}-\d{2}$/.test(bucket.day)) return []
  if (bucket.accountKey !== null && !isText(bucket.accountKey)) return []
  return [
    {
      accountKey: bucket.accountKey,
      day: bucket.day,
      projectKey: bucket.projectKey,
      confidence: bucket.confidence,
      counts
    }
  ]
}

function toLimit(value: unknown): AccountLimit[] {
  const limit = object(value)
  if (!limit || !isAmount(limit.windowMinutes) || !isAmount(limit.usedPercent)) return []
  if (!isAmount(limit.fetchedAtMs) || limit.source !== 'orca-cache') return []
  return [
    {
      windowMinutes: limit.windowMinutes,
      scope: textOrNull(limit.scope),
      usedPercent: limit.usedPercent,
      resetsAtMs: amountOrNull(limit.resetsAtMs),
      source: limit.source,
      fetchedAtMs: limit.fetchedAtMs
    }
  ]
}

export function toStored(state: LedgerState): Record<string, unknown> {
  return {
    version: VERSION,
    ...state,
    buckets: [...state.buckets.values()],
    projects: [...state.projects],
    files: [...state.files],
    codexSessions: [...state.codexSessions],
    limits: [...state.limits]
  }
}

// Rebuilds the ledger field by field, keeping only entries of the right shape: the file may
// have been edited by hand. null when it is not a ledger this version can read at all.
export function fromStored(data: unknown): LedgerState | null {
  const stored = object(data)
  if (!stored || stored.version !== VERSION || !isAmount(stored.trackingSinceMs)) return null
  return {
    trackingSinceMs: stored.trackingSinceMs,
    sampledAtMs: amountOrNull(stored.sampledAtMs),
    accounts: items(stored.accounts).flatMap(toAccount),
    codexDefaultKey: textOrNull(stored.codexDefaultKey),
    spans: items(stored.spans).flatMap(toSpan),
    buckets: new Map(
      items(stored.buckets)
        .flatMap(toBucket)
        .map((bucket) => [bucketId(bucket), bucket])
    ),
    projects: new Map(
      pairs(stored.projects).flatMap(([key, label]): [string, string][] =>
        isText(label) ? [[key, label]] : []
      )
    ),
    files: new Map(
      pairs(stored.files).flatMap(([id, atMs]): [string, number][] =>
        isAmount(atMs) ? [[id, atMs]] : []
      )
    ),
    codexSessions: new Map(
      pairs(stored.codexSessions).flatMap(
        ([key, value]): [string, { counts: TokenCounts; countedAtMs: number }][] => {
          const session = object(value)
          const counts = toCounts(session?.counts)
          return counts && isAmount(session?.countedAtMs)
            ? [[key, { counts, countedAtMs: session.countedAtMs }]]
            : []
        }
      )
    ),
    limits: new Map(
      pairs(stored.limits).map(([key, limits]): [string, AccountLimit[]] => [
        key,
        items(limits).flatMap(toLimit)
      ])
    )
  }
}
