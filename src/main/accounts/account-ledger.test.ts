import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { accountKey } from '../../bridge/account-key'
import { session } from '../../bridge/__fixtures__/helpers'
import type { AccountsState, UsageDelta } from '../../shared/accounts'
import type { OfficeSnapshot, SessionRef } from '../../shared/office/types'
import { AccountLedger } from './account-ledger'
import * as accountsView from './accounts-view'
import type { Identity, IdentityRead } from './identity'
import type { LedgerState } from './ledger-state'
import type { OrcaAccountList } from './orca-accounts'

const START = new Date(2026, 9, 11, 10).getTime()
const identity = (name: string): Identity => ({
  accountUuid: `uuid-${name}`,
  organizationUuid: `org-${name}`,
  emailAddress: `${name}@example.test`,
  organizationName: `${name}@example.test's Organization`,
  organizationRateLimitTier: 'max'
})
const signedIn = (name: string): IdentityRead => ({ status: 'signed-in', identity: identity(name) })
const keyOf = (name: string): string => accountKey('claude', `uuid-${name}`)
const tokens = (output: number) => ({ input: 0, output, cacheWrite: 0, cacheRead: 0 })
const line = (output: number, atMs = Date.now()): UsageDelta => ({
  sessionKey: 'claude:a',
  projectKey: 'p_repo',
  projectLabel: 'repo',
  file: '/p/a.jsonl',
  atMs,
  counts: tokens(output)
})
const usage = (...deltas: unknown[]): unknown => ({ type: 'usage', v: 1, deltas })

function setup(isWatching = true) {
  const disk: { ledger: LedgerState | null } = { ledger: null }
  const deps = {
    isWatching,
    readDefaultIdentity: vi.fn(async (): Promise<IdentityRead> => signedIn('ada')),
    readOrcaIdentities: vi.fn(async (): Promise<Identity[]> => []),
    listOrcaAccounts: vi.fn(async (): Promise<OrcaAccountList | null> => null),
    load: vi.fn(() => disk.ledger && structuredClone(disk.ledger)),
    save: vi.fn((state: LedgerState) => {
      disk.ledger = structuredClone(state)
    })
  }
  const ledger = new AccountLedger(deps)
  const shown: AccountsState[] = []
  ledger.onChange((state) => shown.push(state))
  return { ledger, deps, disk, shown }
}
// Today's output tokens per account key, as the dashboard would read them.
function today(state: AccountsState): Record<string, number> {
  if (state.status !== 'on') return {}
  return Object.fromEntries(
    state.accounts.map((account) => [account.key, account.usage.inferred.today.output])
  )
}
const running = async (isWatching = true) => {
  const context = setup(isWatching)
  context.ledger.start()
  await vi.advanceTimersByTimeAsync(0)
  return context
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(START)
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('while accounts are watched', () => {
  it('loads its ledger, notes who is signed in, and tells the dashboard', async () => {
    const { ledger, deps, shown } = await running()
    expect(deps.load).toHaveBeenCalledOnce()
    expect(deps.readDefaultIdentity).toHaveBeenCalledOnce()
    expect(shown.at(-1)).toMatchObject({
      status: 'on',
      trackingSinceMs: START,
      accounts: [{ key: keyOf('ada'), isActive: true, email: 'ada@example.test' }]
    })
    expect(ledger.view()).toEqual(shown.at(-1))
  })

  it('looks again every fifteen seconds and follows a switch to another account', async () => {
    const { ledger, deps } = await running()
    deps.readDefaultIdentity.mockResolvedValue(signedIn('grace'))
    await vi.advanceTimersByTimeAsync(15_000)
    expect(deps.readDefaultIdentity).toHaveBeenCalledTimes(2)
    expect(ledger.view()).toMatchObject({
      accounts: [
        { key: keyOf('ada'), isActive: false },
        { key: keyOf('grace'), isActive: true }
      ]
    })
  })

  it('counts the tokens the bridge reports under the signed-in account', async () => {
    const { ledger, shown } = await running()
    await vi.advanceTimersByTimeAsync(1_000)
    ledger.ingestBridgeMessage(usage(line(5), line(7, Date.now() - 1)))
    expect(today(ledger.view())).toEqual({ [keyOf('ada')]: 12 })
    await vi.advanceTimersByTimeAsync(5_000)
    expect(today(shown.at(-1)!)).toEqual({ [keyOf('ada')]: 12 })
  })

  it('tells the dashboard about counted tokens once in five seconds, however many ticks added some', async () => {
    const { ledger, shown } = await running()
    await vi.advanceTimersByTimeAsync(1_000)
    const published = shown.length
    for (let tick = 1; tick <= 3; tick++) {
      ledger.ingestBridgeMessage(usage(line(tick, Date.now())))
      await vi.advanceTimersByTimeAsync(1_000)
    }
    expect(shown).toHaveLength(published)
    await vi.advanceTimersByTimeAsync(2_000)
    expect(shown).toHaveLength(published + 1)
    expect(today(shown.at(-1)!)).toEqual({ [keyOf('ada')]: 6 })
    await vi.advanceTimersByTimeAsync(10_000)
    expect(shown).toHaveLength(published + 1)
  })

  it('builds no view of counted tokens while nobody listens for one', async () => {
    const build = vi.spyOn(accountsView, 'toAccountsState')
    const ledger = new AccountLedger(setup().deps)
    ledger.start()
    await vi.advanceTimersByTimeAsync(1_000)
    ledger.ingestBridgeMessage(usage(line(5)))
    await vi.advanceTimersByTimeAsync(10_000)
    expect(build).not.toHaveBeenCalled()
    expect(today(ledger.view())).toEqual({ [keyOf('ada')]: 5 })
  })

  it('holds tokens that arrive before it knows who is signed in, then counts them once', async () => {
    const { ledger, deps } = setup()
    let finishRead = (_read: IdentityRead): void => {}
    deps.readDefaultIdentity.mockReturnValue(new Promise((resolve) => (finishRead = resolve)))
    ledger.start()
    ledger.ingestBridgeMessage(usage(line(5, START + 5)))
    expect(ledger.view()).toEqual({ status: 'off' })
    vi.setSystemTime(START + 10)
    finishRead(signedIn('ada'))
    await vi.advanceTimersByTimeAsync(0)
    // Written before the first look, so no account can be named for it.
    expect(ledger.view()).toMatchObject({
      unattributed: { usage: { today: tokens(5) } }
    })
  })

  it('ignores anything from the bridge that is not well-formed token counts', async () => {
    const { ledger, shown } = await running()
    await vi.advanceTimersByTimeAsync(1_000)
    const published = shown.length
    for (const message of [
      null,
      'usage',
      { type: 'hello', v: 1, snapshot: {} },
      { type: 'usage', v: 2, deltas: [line(1)] },
      { type: 'usage', v: 1, deltas: 'many' },
      usage({ ...line(1), counts: { ...tokens(1), input: -1 } }),
      usage({ ...line(1), atMs: 'now' }),
      usage({ ...line(1), file: 7 }),
      usage({ ...line(1), counts: null }),
      usage('line')
    ]) {
      ledger.ingestBridgeMessage(message)
    }
    expect(shown).toHaveLength(published)
    ledger.ingestBridgeMessage(usage({ ...line(1), projectLabel: 9 }, line(3)))
    await vi.advanceTimersByTimeAsync(5_000)
    expect(today(shown.at(-1)!)).toEqual({ [keyOf('ada')]: 3 })
  })

  it('counts what Codex sessions spend, under the account each one names', async () => {
    const { ledger } = await running()
    const codexKey = accountKey('codex', 'acct_1')
    const codex: SessionRef = {
      ...session('c'),
      key: 'codex:c',
      provider: 'codex',
      startedAtMs: START + 1,
      threadStartedAtMs: START + 1,
      accountKey: codexKey,
      accountConfidence: 'exact',
      usage: {
        own: tokens(40),
        subagents: tokens(0),
        spawned: 0,
        contextTokens: null,
        contextLimit: null
      }
    }
    ledger.observeSessions([session('a'), codex])
    const view = ledger.view()
    if (view.status !== 'on') throw new Error('expected a watching state')
    expect(view.accounts.find((account) => account.key === codexKey)?.usage.exact.today).toEqual(
      tokens(40)
    )
  })

  it('takes a Codex session it was shown before its first look as seen at that look, not at the next feed message', async () => {
    const { ledger, deps } = setup()
    let finishRead = (_read: IdentityRead): void => {}
    deps.readDefaultIdentity.mockReturnValue(new Promise((resolve) => (finishRead = resolve)))
    ledger.start()
    const codexKey = accountKey('codex', 'acct_1')
    const spent = (output: number): SessionRef => ({
      ...session('c'),
      key: 'codex:c',
      provider: 'codex',
      accountKey: codexKey,
      // A thread older than the ledger: what it had already spent is never counted.
      threadStartedAtMs: START - 60_000,
      usage: {
        own: tokens(output),
        subagents: tokens(0),
        spawned: 0,
        contextTokens: null,
        contextLimit: null
      }
    })
    ledger.observeSessions([spent(100)])
    finishRead(signedIn('ada'))
    await vi.advanceTimersByTimeAsync(0)
    // The feed stays quiet until the session spends again: only the growth since the look counts.
    ledger.observeSessions([spent(150)])
    const view = ledger.view()
    if (view.status !== 'on') throw new Error('expected a watching state')
    expect(view.accounts.find((account) => account.key === codexKey)?.usage.exact.today).toEqual(
      tokens(50)
    )
  })

  it('lets the owner name an account, and saves the name', async () => {
    const { ledger, deps, disk } = await running()
    expect(ledger.setAlias(keyOf('ada'), 'Work')).toEqual({ success: true })
    expect(ledger.view()).toMatchObject({ accounts: [{ alias: 'Work', label: 'Work' }] })
    expect(ledger.setAlias('claude:nobody', 'Work')).toMatchObject({ reason: 'unknown-account' })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(deps.save).toHaveBeenCalled()
    expect(disk.ledger?.accounts[0].alias).toBe('Work')
  })
})

describe('saving', () => {
  it('writes shortly after a change, once, and not again while nothing changes', async () => {
    const { ledger, deps } = await running()
    await vi.advanceTimersByTimeAsync(30_000)
    expect(deps.save).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    expect(deps.save).toHaveBeenCalledOnce()
    ledger.ingestBridgeMessage(usage(line(5)))
    ledger.ingestBridgeMessage(usage(line(6, Date.now() + 1)))
    // Counted tokens can be counted again from the transcripts, so they wait two minutes.
    await vi.advanceTimersByTimeAsync(119_000)
    expect(deps.save).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(1_000)
    expect(deps.save).toHaveBeenCalledTimes(2)
  })

  it('writes a name the owner gave within thirty seconds, even while counted tokens wait longer', async () => {
    const { ledger, deps, disk } = await running()
    await vi.advanceTimersByTimeAsync(30_000)
    ledger.ingestBridgeMessage(usage(line(5)))
    await vi.advanceTimersByTimeAsync(10_000)
    ledger.setAlias(keyOf('ada'), 'Work')
    await vi.advanceTimersByTimeAsync(30_000)
    expect(deps.save).toHaveBeenCalledTimes(2)
    expect(disk.ledger?.accounts[0].alias).toBe('Work')
    // That write carried the tokens too: nothing is left to save.
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(deps.save).toHaveBeenCalledTimes(2)
  })

  it('writes what is pending when the app stops, and stops looking', async () => {
    const { ledger, deps, disk } = await running()
    await vi.advanceTimersByTimeAsync(1_000)
    ledger.ingestBridgeMessage(usage(line(5)))
    ledger.stop()
    expect([...(disk.ledger?.buckets.values() ?? [])]).toMatchObject([{ counts: tokens(5) }])
    const reads = deps.readDefaultIdentity.mock.calls.length
    await vi.advanceTimersByTimeAsync(60_000)
    expect(deps.readDefaultIdentity).toHaveBeenCalledTimes(reads)
  })

  it('keeps its totals across a restart and does not count the same lines again', async () => {
    const first = await running()
    await vi.advanceTimersByTimeAsync(1_000)
    const counted = line(5)
    first.ledger.ingestBridgeMessage(usage(counted))
    first.ledger.stop()

    const second = setup()
    second.disk.ledger = first.disk.ledger
    second.ledger.start()
    await vi.advanceTimersByTimeAsync(60_000)
    // A restarted bridge reports every live transcript again from its first line.
    second.ledger.ingestBridgeMessage(usage(counted, line(2)))
    expect(second.ledger.view()).toMatchObject({ trackingSinceMs: START })
    expect(today(second.ledger.view())).toEqual({ [keyOf('ada')]: 7 })
  })

  it('carries on when the file cannot be written, and tries again at the next change', async () => {
    const { ledger, deps } = await running()
    const failure = vi.spyOn(console, 'error').mockImplementation(() => {})
    deps.save.mockImplementationOnce(() => {
      throw new Error('ENOSPC ada@example.test')
    })
    await vi.advanceTimersByTimeAsync(30_000)
    expect(failure).toHaveBeenCalledExactlyOnceWith('[accounts] the ledger could not be saved')
    ledger.ingestBridgeMessage(usage(line(5)))
    await vi.advanceTimersByTimeAsync(2 * 60_000)
    expect(deps.save).toHaveBeenCalledTimes(2)
  })
})

describe('the Orca mirror', () => {
  it('asks Orca once at start and then every five minutes', async () => {
    const { deps } = await running()
    expect(deps.listOrcaAccounts).toHaveBeenCalledOnce()
    expect(deps.readOrcaIdentities).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(deps.listOrcaAccounts).toHaveBeenCalledTimes(2)
  })

  it('asks again when the Accounts view opens, but not within thirty seconds of the last time', async () => {
    const { ledger, deps } = await running()
    await ledger.dashboardState()
    expect(deps.listOrcaAccounts).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(31_000)
    expect((await ledger.dashboardState()).status).toBe('on')
    await ledger.dashboardState()
    await vi.advanceTimersByTimeAsync(0)
    expect(deps.listOrcaAccounts).toHaveBeenCalledTimes(2)
  })

  it('lists every account Orca knows, with or without its command line', async () => {
    const { ledger, deps } = setup()
    deps.readOrcaIdentities.mockResolvedValue([identity('ada'), identity('grace')])
    ledger.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(ledger.view()).toMatchObject({
      accounts: [
        { key: keyOf('ada'), isActive: true, sources: ['default-login', 'orca'] },
        { key: keyOf('grace'), isActive: false, sources: ['orca'] }
      ]
    })
  })
})

describe('while accounts are not watched', () => {
  it('reads nothing, counts nothing and writes nothing', async () => {
    const { ledger, deps, shown } = await running(false)
    ledger.ingestBridgeMessage(usage(line(5)))
    ledger.observeSessions([session('a')])
    await vi.advanceTimersByTimeAsync(10 * 60_000)
    ledger.stop()
    for (const dependency of Object.values(deps)) {
      if (typeof dependency === 'function') expect(dependency).not.toHaveBeenCalled()
    }
    expect(await ledger.dashboardState()).toEqual({ status: 'off' })
    expect(ledger.setAlias(keyOf('ada'), 'Work')).toEqual({ success: false, reason: 'off' })
    expect(shown).toEqual([])
  })

  it('saves and goes quiet when watching is switched off, and resumes when switched on', async () => {
    const { ledger, deps, disk, shown } = await running()
    await vi.advanceTimersByTimeAsync(1_000)
    ledger.ingestBridgeMessage(usage(line(5)))
    ledger.setWatching(false)
    expect(shown.at(-1)).toEqual({ status: 'off' })
    expect([...(disk.ledger?.buckets.values() ?? [])]).toHaveLength(1)
    const reads = deps.readDefaultIdentity.mock.calls.length
    const saves = deps.save.mock.calls.length
    ledger.ingestBridgeMessage(usage(line(9, Date.now() + 5)))
    await vi.advanceTimersByTimeAsync(5 * 60_000)
    expect(deps.readDefaultIdentity).toHaveBeenCalledTimes(reads)
    expect(deps.save).toHaveBeenCalledTimes(saves)

    ledger.setWatching(true)
    await vi.advanceTimersByTimeAsync(0)
    expect(today(ledger.view())).toEqual({ [keyOf('ada')]: 5 })
  })
})

describe('the Office', () => {
  const snapshot: OfficeSnapshot = {
    rev: 2,
    generatedAtMs: START,
    sources: [],
    sessions: [session('a')]
  }

  it('is told when an account’s label or sign-in changes, and not when tokens are counted', async () => {
    const { ledger, deps } = await running()
    const onOfficeChange = vi.fn()
    ledger.onOfficeChange(onOfficeChange)
    await vi.advanceTimersByTimeAsync(1_000)
    ledger.ingestBridgeMessage(usage(line(5)))
    await vi.advanceTimersByTimeAsync(15_000)
    expect(onOfficeChange).not.toHaveBeenCalled()
    ledger.setAlias(keyOf('ada'), 'Work')
    expect(onOfficeChange).toHaveBeenCalledOnce()
    deps.readDefaultIdentity.mockResolvedValue(signedIn('grace'))
    await vi.advanceTimersByTimeAsync(15_000)
    expect(onOfficeChange).toHaveBeenCalledTimes(2)
  })

  it('never receives an email, an account id or an organisation id, and neither does a log', async () => {
    const logs = ['log', 'info', 'warn', 'error'].map((level) =>
      vi.spyOn(console, level as 'log').mockImplementation(() => {})
    )
    const { ledger, deps } = setup()
    deps.readOrcaIdentities.mockResolvedValue([identity('grace')])
    deps.load.mockImplementationOnce(() => {
      throw new Error('EACCES /Users/ada@example.test/ledger')
    })
    ledger.start()
    await vi.advanceTimersByTimeAsync(15_000)
    ledger.ingestBridgeMessage(usage(line(5)))
    const sent = JSON.stringify([ledger.decorate(snapshot), logs.map((log) => log.mock.calls)])
    expect(sent).toContain(keyOf('ada'))
    expect(sent).not.toMatch(/@|example\.test|uuid-|org-/)
  })

  it('sees sessions without accounts while accounts are not watched', async () => {
    const { ledger } = await running(false)
    expect(ledger.decorate(snapshot)).toMatchObject({
      accounts: [],
      sessions: [{ accountKey: null }]
    })
  })
})
