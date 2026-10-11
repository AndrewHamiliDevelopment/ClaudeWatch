import { describe, expect, it } from 'vitest'
import {
  accountDisplayName,
  accountTokenRows,
  limitWindowName,
  orderAccounts,
  readAccountLimit,
  splitWindow
} from '../account-view'
import {
  accountFixture,
  accountsFixture,
  brassHarbor,
  counts,
  lanternWorks,
  limitFixture,
  NOW_MS,
  windowsFixture
} from './fixtures'

const HOUR_MS = 3_600_000

describe('accountDisplayName', () => {
  it('prefers the alias, then the organisation, then the label', () => {
    expect(accountDisplayName(accountFixture({ alias: 'Work' }))).toBe('Work')
    expect(accountDisplayName(accountFixture())).toBe('Lantern Works')
    expect(
      accountDisplayName(accountFixture({ organizationName: null, label: 'Claude account 1b2c' }))
    ).toBe('Claude account 1b2c')
  })
})

describe('orderAccounts', () => {
  it('puts the signed-in account first and keeps the rest in order', () => {
    const third = accountFixture({ key: 'codex:eeee', label: 'Third' })
    const ordered = orderAccounts([lanternWorks, third, brassHarbor])
    expect(ordered.map((account) => account.label)).toEqual([
      'Brass Harbor',
      'Lantern Works',
      'Third'
    ])
  })
})

describe('splitWindow', () => {
  it('adds the exact and inferred parts of one window', () => {
    expect(splitWindow(brassHarbor.usage, 'today')).toEqual({
      exact: 1_500,
      inferred: 500,
      total: 2_000,
      parts: counts(1_200, 600, 50, 150)
    })
  })

  it('reports a part that has not been counted as unknown, and the total with it', () => {
    const split = splitWindow({ exact: windowsFixture(counts(5), counts(5), counts(5)) }, 'today')
    expect(split).toEqual({ exact: 5, inferred: null, total: null, parts: null })
  })
})

describe('limitWindowName', () => {
  it('names a window from its length and its scope', () => {
    expect(limitWindowName(limitFixture({ windowMinutes: 300 }))).toBe('5-hour')
    expect(limitWindowName(limitFixture({ windowMinutes: 10080 }))).toBe('7-day')
    expect(limitWindowName(limitFixture({ windowMinutes: 45 }))).toBe('45-minute')
    expect(limitWindowName(limitFixture({ windowMinutes: 10080, scope: 'fable' }))).toBe(
      '7-day, fable'
    )
  })
})

describe('readAccountLimit', () => {
  it('reads a recent limit as current', () => {
    expect(readAccountLimit(limitFixture(), NOW_MS)).toMatchObject({
      percent: 42,
      age: 'current',
      ageText: 'as of 2m ago'
    })
  })

  it('marks a reading older than fifteen minutes as old', () => {
    const limit = limitFixture({ fetchedAtMs: NOW_MS - 4 * HOUR_MS })
    expect(readAccountLimit(limit, NOW_MS)).toMatchObject({ age: 'old', ageText: 'as of 4h ago' })
  })

  it('says so when the window has reset since the reading', () => {
    const limit = limitFixture({ fetchedAtMs: NOW_MS - 6 * HOUR_MS, resetsAtMs: NOW_MS - 1 })
    expect(readAccountLimit(limit, NOW_MS).age).toBe('reset')
  })
})

describe('accountTokenRows', () => {
  it('has nothing to compare with one account, or while accounts are not watched', () => {
    expect(accountTokenRows({ status: 'off' })).toEqual([])
    expect(accountTokenRows(accountsFixture({ accounts: [brassHarbor] }))).toEqual([])
  })

  it('lists today’s tokens for each account by the name the owner sees', () => {
    const renamed = { ...lanternWorks, alias: 'Side project' }
    expect(accountTokenRows(accountsFixture({ accounts: [renamed, brassHarbor] }))).toEqual([
      { key: renamed.key, name: 'Side project', tokens: 0 },
      { key: brassHarbor.key, name: 'Brass Harbor', tokens: 2_000 }
    ])
  })

  it('leaves out an account whose tokens are still being counted', () => {
    // What a ledger mid-count can send, whatever the contract promises.
    const uncounted = Object.assign(accountFixture({ key: 'claude:ffff' }), { usage: {} })
    const rows = accountTokenRows(
      accountsFixture({ accounts: [uncounted, brassHarbor, lanternWorks] })
    )
    expect(rows.map((row) => row.key)).toEqual([brassHarbor.key, lanternWorks.key])
  })
})
