import type { AccountConfidence, AccountRef, TokenCounts } from './office/types'

// Tokens one transcript line added, as the bridge reports them to main. Numbers and labels only.
export interface UsageDelta {
  sessionKey: string
  projectKey: string
  projectLabel: string
  // The transcript the line came from: the ledger counts each line of a file once.
  file: string
  atMs: number
  counts: TokenCounts
}

export interface UsageMessage {
  type: 'usage'
  v: 1
  deltas: UsageDelta[]
}

export type AccountSource = 'default-login' | 'orca' | 'codex-rollout'

// Local calendar days: `last7Days` is today and the six days before it.
export interface UsageWindows {
  today: TokenCounts
  last7Days: TokenCounts
  sinceTracking: TokenCounts
}

export interface ProjectUsage {
  projectKey: string
  projectLabel: string
  usage: UsageWindows
}

// One limit window as last read; `fetchedAtMs` is its age, and a missing window is unknown.
export interface AccountLimit {
  windowMinutes: number
  // Set when the window covers one model family only. Display words in a view ("Fable");
  // the source's own name ("fableWeekly") inside the ledger.
  scope: string | null
  usedPercent: number
  resetsAtMs: number | null
  source: 'orca-cache'
  fetchedAtMs: number
}

// `label` is what the Office may show. The email stays on the dashboard.
export interface AccountSummary extends AccountRef {
  alias: string | null
  organizationName: string | null
  email: string | null
  sources: AccountSource[]
  firstSeenMs: number
  // exact: the session names its account. inferred: by which account was signed in at the time.
  usage: Record<Exclude<AccountConfidence, 'unattributed'>, UsageWindows>
  projects: ProjectUsage[]
  limits: AccountLimit[]
}

export type AccountsState =
  // `watchAccounts` is off: nothing is read, nothing is counted.
  | { status: 'off' }
  | {
      status: 'on'
      generatedAtMs: number
      // Tokens are counted on this Mac from this moment on; nothing earlier is attributed.
      trackingSinceMs: number
      accounts: AccountSummary[]
      // Counted, but spent while the signed-in account was not known.
      unattributed: { usage: UsageWindows; projects: ProjectUsage[] }
    }

export const MAX_ALIAS_LENGTH = 40

export interface AliasResult {
  success: boolean
  reason?: 'off' | 'unknown-account' | 'invalid-alias'
}
