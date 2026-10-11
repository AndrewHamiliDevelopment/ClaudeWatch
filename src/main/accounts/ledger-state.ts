import { addCounts } from '../../shared/office/token-counts'
import type { AccountLimit, AccountSource } from '../../shared/accounts'
import type { AccountConfidence, ProviderId, TokenCounts } from '../../shared/office/types'

// Main only. The email is the one personal value kept, and only the dashboard is sent it.
export interface AccountRecord {
  // `${provider}:${hash of the provider's account id}`; the id itself is not stored.
  key: string
  provider: ProviderId
  email: string | null
  organizationUuid: string | null
  organizationName: string | null
  plan: string | null
  alias: string | null
  orcaAccountId: string | null
  sources: AccountSource[]
  firstSeenMs: number
}

// A stretch of time one account was signed in on the shared login; open while `toMs` is null.
export interface IdentitySpan {
  accountKey: string
  fromMs: number
  toMs: number | null
}

export interface UsageBucket {
  // null: spent while nobody knew which account was signed in.
  accountKey: string | null
  day: string // local YYYY-MM-DD
  projectKey: string
  confidence: AccountConfidence
  counts: TokenCounts
}

export interface LedgerState {
  // Nothing written before this moment is ever counted.
  trackingSinceMs: number
  sampledAtMs: number | null
  accounts: AccountRecord[]
  codexDefaultKey: string | null
  spans: IdentitySpan[]
  buckets: Map<string, UsageBucket>
  projects: Map<string, string>
  // Transcript id to the time of its last counted line.
  files: Map<string, number>
  // Codex session key to the highest running total already counted.
  codexSessions: Map<string, { counts: TokenCounts; countedAtMs: number }>
  limits: Map<string, AccountLimit[]>
}

// How long a quiet transcript or a closed span is remembered. A line older than this in a
// transcript the ledger has no place for is not counted, which keeps forgetting safe.
export const RETENTION_MS = 7 * 24 * 60 * 60 * 1000

export function emptyLedger(now: number): LedgerState {
  return {
    trackingSinceMs: now,
    sampledAtMs: null,
    accounts: [],
    codexDefaultKey: null,
    spans: [],
    buckets: new Map(),
    projects: new Map(),
    files: new Map(),
    codexSessions: new Map(),
    limits: new Map()
  }
}

export function dayKey(atMs: number): string {
  const date = new Date(atMs)
  const twoDigits = (value: number): string => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`
}

export const bucketId = (bucket: Omit<UsageBucket, 'counts'>): string =>
  [bucket.accountKey ?? '', bucket.day, bucket.projectKey, bucket.confidence].join('|')

export function addUsage(state: LedgerState, bucket: UsageBucket): void {
  const id = bucketId(bucket)
  const existing = state.buckets.get(id)
  state.buckets.set(
    id,
    existing ? { ...existing, counts: addCounts(existing.counts, bucket.counts) } : bucket
  )
}
