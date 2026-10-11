import type {
  AccountLimit,
  AccountsState,
  AccountSummary,
  UsageWindows
} from '../../../shared/accounts'
import { addCounts, sumCounts } from '../../../shared/office/token-counts'
import type { TokenCounts } from '../../../shared/office/types'
import { timeAgo } from '../../lib/utils'
import type { LedgerRow } from '../GaugeWall'

type UsageWindowKey = keyof UsageWindows

export const USAGE_WINDOWS: readonly { key: UsageWindowKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'last7Days', label: 'Last 7 days' },
  { key: 'sinceTracking', label: 'Since tracking began' }
]

// A ledger still counting can leave a window out, whatever the contract promises, and a
// missing number must read as unknown rather than 0.
type CountedWindows = Partial<UsageWindows>
type CountedUsage = Partial<Record<keyof AccountSummary['usage'], CountedWindows>>

export function accountDisplayName(
  account: Pick<AccountSummary, 'alias' | 'organizationName' | 'label'>
): string {
  return account.alias || account.organizationName || account.label
}

export function orderAccounts(accounts: readonly AccountSummary[]): AccountSummary[] {
  return [...accounts].sort((a, b) => Number(b.isActive) - Number(a.isActive))
}

export function windowTokens(
  windows: CountedWindows | undefined,
  key: UsageWindowKey
): number | null {
  const counted = windows?.[key]
  return counted ? sumCounts(counted) : null
}

export interface WindowSplit {
  exact: number | null
  inferred: number | null
  total: number | null
  // Exact and inferred added part by part.
  parts: TokenCounts | null
}

export function splitWindow(usage: CountedUsage, key: UsageWindowKey): WindowSplit {
  const exact = usage.exact?.[key]
  const inferred = usage.inferred?.[key]
  const isCounted = exact !== undefined && inferred !== undefined
  return {
    exact: exact ? sumCounts(exact) : null,
    inferred: inferred ? sumCounts(inferred) : null,
    total: isCounted ? sumCounts(exact) + sumCounts(inferred) : null,
    parts: isCounted ? addCounts(exact, inferred) : null
  }
}

const MINUTES_PER_HOUR = 60
const MINUTES_PER_DAY = 1440

export function limitWindowName({ windowMinutes, scope }: AccountLimit): string {
  const length =
    windowMinutes % MINUTES_PER_DAY === 0
      ? `${windowMinutes / MINUTES_PER_DAY}-day`
      : windowMinutes % MINUTES_PER_HOUR === 0
        ? `${windowMinutes / MINUTES_PER_HOUR}-hour`
        : `${windowMinutes}-minute`
  return scope ? `${length}, ${scope}` : length
}

// Orca refreshes its cache every few minutes; a reading past this is no longer the present.
const OLD_READING_MS = 15 * 60_000

type LimitAge = 'current' | 'old' | 'reset'

export interface AccountLimitReading {
  percent: number
  age: LimitAge
  ageText: string
}

export function readAccountLimit(limit: AccountLimit, nowMs: number): AccountLimitReading {
  const hasReset = limit.resetsAtMs !== null && limit.resetsAtMs <= nowMs
  const isOld = nowMs - limit.fetchedAtMs > OLD_READING_MS
  return {
    percent: Math.min(100, Math.max(0, limit.usedPercent)),
    age: hasReset ? 'reset' : isOld ? 'old' : 'current',
    ageText: `as of ${timeAgo(new Date(limit.fetchedAtMs), nowMs)}`
  }
}

// Today's tokens per account for the dashboard: a comparison, so one account alone has no rows.
export function accountTokenRows(state: AccountsState): LedgerRow[] {
  if (state.status === 'off' || state.accounts.length < 2) return []
  return state.accounts.flatMap((account) => {
    const { total } = splitWindow(account.usage, 'today')
    return total === null
      ? []
      : [{ key: account.key, name: accountDisplayName(account), tokens: total }]
  })
}
