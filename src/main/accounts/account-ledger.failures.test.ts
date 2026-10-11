import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { UsageDelta } from '../../shared/accounts'
import { AccountLedger } from './account-ledger'
import type { IdentityRead } from './identity'
import { emptyLedger, type LedgerState } from './ledger-state'

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
const line = (output: number): UsageDelta => ({
  sessionKey: 'claude:a',
  projectKey: 'p_repo',
  projectLabel: 'repo',
  file: '/p/a.jsonl',
  atMs: Date.now(),
  counts: { input: 0, output, cacheWrite: 0, cacheRead: 0 }
})

function setup() {
  const deps = {
    isWatching: true,
    readDefaultIdentity: vi.fn(async () => signedIn),
    readOrcaIdentities: vi.fn(async () => []),
    listOrcaAccounts: vi.fn(async () => null),
    load: vi.fn((): LedgerState | null => null),
    save: vi.fn()
  }
  return { deps, ledger: new AccountLedger(deps) }
}
let logged: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  vi.useFakeTimers()
  logged = vi.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

it('survives a look that fails, says so without the reason, and looks again', async () => {
  const { deps, ledger } = setup()
  deps.readDefaultIdentity.mockRejectedValueOnce(new Error('EIO /Users/ada@example.test'))
  ledger.start()
  await vi.advanceTimersByTimeAsync(0)
  expect(logged.mock.calls).toEqual([['[accounts] the sign-in could not be read']])
  expect(ledger.view()).toEqual({ status: 'off' })
  await vi.advanceTimersByTimeAsync(15_000)
  expect(ledger.view()).toMatchObject({ status: 'on', accounts: [{ isActive: true }] })
})

it('survives Orca’s list failing, and keeps the accounts it already has', async () => {
  const { deps, ledger } = setup()
  deps.readOrcaIdentities.mockRejectedValue(new Error('EACCES ada@example.test'))
  ledger.start()
  await vi.advanceTimersByTimeAsync(0)
  expect(logged.mock.calls).toEqual([['[accounts] Orca’s accounts could not be read']])
  expect(ledger.view()).toMatchObject({ status: 'on', accounts: [{ isActive: true }] })
})

it('holds no token counts while its ledger cannot be read, and counts them when reported again', async () => {
  const { deps, ledger } = setup()
  const trackingSinceMs = Date.now() - 60_000
  deps.load.mockImplementation(() => {
    throw new Error('EACCES')
  })
  ledger.start()
  const lines: UsageDelta[] = []
  for (let tick = 0; tick < 20; tick++) {
    await vi.advanceTimersByTimeAsync(2_000)
    lines.push(line(1))
    ledger.ingestBridgeMessage({ type: 'usage', v: 1, deltas: [lines.at(-1)] })
  }
  // Reported once, not on every look.
  expect(logged.mock.calls).toEqual([['[accounts] the ledger could not be read']])

  deps.load.mockImplementation(() => ({ ...emptyLedger(trackingSinceMs) }))
  await vi.advanceTimersByTimeAsync(15_000)
  const spent = (): number => {
    const view = ledger.view()
    if (view.status !== 'on') return Number.NaN
    return (
      view.unattributed.usage.today.output + (view.accounts[0]?.usage.inferred.today.output ?? 0)
    )
  }
  // Nothing was kept in memory for a ledger that might never load.
  expect(spent()).toBe(0)
  // The bridge reports a transcript from its first line again when it restarts.
  ledger.ingestBridgeMessage({ type: 'usage', v: 1, deltas: lines })
  expect(spent()).toBe(20)
})
