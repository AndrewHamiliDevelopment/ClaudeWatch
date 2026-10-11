import type {
  AccountLimit,
  AccountsState,
  AccountSummary,
  UsageWindows
} from '../../../../shared/accounts'
import type { TokenCounts } from '../../../../shared/office/types'

export const NOW_MS = new Date('2026-10-11T12:00:00').getTime()
export const TRACKING_SINCE_MS = new Date('2026-10-01T09:00:00').getTime()
const MINUTE_MS = 60_000

export const counts = (input: number, output = 0, cacheWrite = 0, cacheRead = 0): TokenCounts => ({
  input,
  output,
  cacheWrite,
  cacheRead
})

export function windowsFixture(
  today: TokenCounts,
  last7Days: TokenCounts,
  sinceTracking: TokenCounts
): UsageWindows {
  return { today, last7Days, sinceTracking }
}

const NO_USAGE = windowsFixture(counts(0), counts(0), counts(0))

export function limitFixture(overrides: Partial<AccountLimit> = {}): AccountLimit {
  return {
    windowMinutes: 300,
    scope: null,
    usedPercent: 42,
    resetsAtMs: NOW_MS + 90 * MINUTE_MS,
    source: 'orca-cache',
    fetchedAtMs: NOW_MS - 2 * MINUTE_MS,
    ...overrides
  }
}

export function accountFixture(overrides: Partial<AccountSummary> = {}): AccountSummary {
  return {
    key: 'claude:aaaa1111bbbb',
    provider: 'claude',
    label: 'Lantern Works',
    plan: 'Max 20x',
    isActive: false,
    alias: null,
    organizationName: 'Lantern Works',
    email: 'ada@lantern.example',
    sources: ['orca'],
    firstSeenMs: TRACKING_SINCE_MS,
    usage: { exact: NO_USAGE, inferred: NO_USAGE },
    projects: [],
    limits: [],
    ...overrides
  }
}

export type WatchedAccounts = Extract<AccountsState, { status: 'on' }>

export function accountsFixture(overrides: Partial<WatchedAccounts> = {}): WatchedAccounts {
  return {
    status: 'on',
    generatedAtMs: NOW_MS,
    trackingSinceMs: TRACKING_SINCE_MS,
    accounts: [],
    unattributed: { usage: NO_USAGE, projects: [] },
    ...overrides
  }
}

// Not signed in, and its only limit was read four hours ago.
export const lanternWorks = accountFixture({
  limits: [
    limitFixture({ windowMinutes: 10080, usedPercent: 71, fetchedAtMs: NOW_MS - 240 * MINUTE_MS })
  ]
})

// Signed in, with exact and inferred tokens, two projects and a fresh limit.
export const brassHarbor = accountFixture({
  key: 'claude:cccc2222dddd',
  label: 'Brass Harbor',
  organizationName: 'Brass Harbor',
  email: 'grace@brassharbor.example',
  plan: 'Max 5x',
  isActive: true,
  usage: {
    exact: windowsFixture(counts(1_000, 500), counts(4_000), counts(9_000)),
    inferred: windowsFixture(counts(200, 100, 50, 150), counts(2_000), counts(3_000))
  },
  projects: [
    {
      projectKey: 'p_cw',
      projectLabel: 'ClaudeWatch',
      usage: windowsFixture(counts(1_800), counts(5_000), counts(10_000))
    },
    {
      projectKey: 'p_pa',
      projectLabel: 'PropApp',
      usage: windowsFixture(counts(200), counts(1_000), counts(2_000))
    }
  ],
  limits: [limitFixture()]
})
