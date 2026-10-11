import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { accountKey } from '../../bridge/account-key'
import { session } from '../../bridge/__fixtures__/helpers'
import type { AccountsState, CodexTotal } from '../../shared/accounts'
import type { SessionRef, TokenCounts } from '../../shared/office/types'
import { AccountLedger } from './account-ledger'
import type { IdentityRead } from './identity'
import type { LedgerState } from './ledger-state'

const START = new Date(2026, 9, 11, 10).getTime()
const signedIn: IdentityRead = {
  status: 'signed-in',
  identity: {
    accountUuid: 'uuid-ada',
    organizationUuid: 'org-ada',
    emailAddress: 'ada@example.test',
    organizationName: 'Ada Labs',
    organizationRateLimitTier: 'max'
  }
}
const codexKey = accountKey('codex', 'acct_1')
const tokens = (output: number): TokenCounts => ({ input: 0, output, cacheWrite: 0, cacheRead: 0 })
const total = (output: number, overrides: Partial<CodexTotal> = {}): CodexTotal => ({
  sessionKey: 'codex:c',
  projectKey: 'p_repo',
  projectLabel: 'repo',
  accountKey: codexKey,
  threadStartedAtMs: START + 1,
  counts: tokens(output),
  ...overrides
})
const posted = (...totals: unknown[]): unknown => ({ type: 'codex-usage', v: 1, totals })
// The same session as the feed shows it, its numbers possibly held back for display.
const shown = (output: number): SessionRef => ({
  ...session('c'),
  key: 'codex:c',
  provider: 'codex',
  threadStartedAtMs: START + 1,
  accountKey: codexKey,
  usage: {
    own: tokens(output),
    subagents: tokens(0),
    spawned: 0,
    contextTokens: null,
    contextLimit: null
  }
})

function setup() {
  const deps = {
    isWatching: true,
    readDefaultIdentity: vi.fn(async (): Promise<IdentityRead> => signedIn),
    readOrcaIdentities: vi.fn(async () => []),
    listOrcaAccounts: vi.fn(async () => null),
    load: vi.fn((): LedgerState | null => null),
    save: vi.fn()
  }
  return { deps, ledger: new AccountLedger(deps) }
}
function spentToday(state: AccountsState): TokenCounts | undefined {
  if (state.status !== 'on') return undefined
  return state.accounts.find((account) => account.key === codexKey)?.usage.exact.today
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('counts a Codex total the bridge posts beside the feed, whatever older number the feed still shows', async () => {
  const { ledger } = setup()
  ledger.start()
  await vi.advanceTimersByTimeAsync(0)
  ledger.observeSessions([shown(100)])
  ledger.ingestBridgeMessage(posted(total(150)))
  expect(spentToday(ledger.view())).toEqual(tokens(150))
  // The feed catches up, or never does because the session has left: nothing is counted twice.
  ledger.observeSessions([shown(100)])
  ledger.observeSessions([shown(150)])
  ledger.observeSessions([])
  expect(spentToday(ledger.view())).toEqual(tokens(150))
})

it('holds Codex totals that arrive before it knows who is signed in, then counts them once', async () => {
  const { ledger, deps } = setup()
  let finishRead = (_read: IdentityRead): void => {}
  deps.readDefaultIdentity.mockReturnValue(new Promise((resolve) => (finishRead = resolve)))
  ledger.start()
  ledger.ingestBridgeMessage(posted(total(100)))
  ledger.ingestBridgeMessage(posted(total(150)))
  expect(ledger.view()).toEqual({ status: 'off' })
  finishRead(signedIn)
  await vi.advanceTimersByTimeAsync(0)
  expect(spentToday(ledger.view())).toEqual(tokens(150))
  await vi.advanceTimersByTimeAsync(15_000)
  expect(spentToday(ledger.view())).toEqual(tokens(150))
})

it('counts no Codex total while accounts are not watched, and none that is malformed', async () => {
  const { ledger } = setup()
  ledger.setWatching(false)
  ledger.ingestBridgeMessage(posted(total(100)))
  ledger.setWatching(true)
  await vi.advanceTimersByTimeAsync(0)
  expect(ledger.view()).toMatchObject({ status: 'on' })
  expect(spentToday(ledger.view())).toBeUndefined()

  ledger.ingestBridgeMessage(posted({ ...total(100), counts: { ...tokens(100), output: -1 } }))
  ledger.ingestBridgeMessage(posted({ ...total(100), accountKey: 'ada@example.test' }))
  expect(spentToday(ledger.view())).toBeUndefined()
})
