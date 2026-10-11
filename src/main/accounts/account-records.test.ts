import { describe, expect, it } from 'vitest'
import { accountKey } from '../../bridge/account-key'
import { MAX_ALIAS_LENGTH } from '../../shared/accounts'
import { mergeOrcaAccounts, setAlias, upsertClaudeAccount } from './account-records'
import type { Identity } from './identity'
import { emptyLedger } from './ledger-state'
import type { OrcaAccountList } from './orca-accounts'

const identity = (name: string, overrides: Partial<Identity> = {}): Identity => ({
  accountUuid: `uuid-${name}`,
  organizationUuid: `org-${name}`,
  emailAddress: `${name}@example.test`,
  organizationName: `${name} Org`,
  organizationRateLimitTier: 'default_claude_max_20x',
  ...overrides
})
const keyOf = (name: string): string => accountKey('claude', `uuid-${name}`)
const orcaList = (overrides: Partial<OrcaAccountList> = {}): OrcaAccountList => ({
  claude: [],
  claudeLimits: [],
  codex: null,
  ...overrides
})
const weekly = {
  windowMinutes: 10080,
  scope: null,
  usedPercent: 12,
  resetsAtMs: 9_000,
  source: 'orca-cache' as const,
  fetchedAtMs: 5_000
}

describe('one account, one card', () => {
  it('records an identity under a key that does not reveal its account id', () => {
    const state = emptyLedger(1_000)
    upsertClaudeAccount(state, identity('ada'), 'default-login', 2_000)
    expect(state.accounts).toEqual([
      {
        key: keyOf('ada'),
        provider: 'claude',
        email: 'ada@example.test',
        organizationUuid: 'org-ada',
        organizationName: 'ada Org',
        plan: 'default_claude_max_20x',
        alias: null,
        orcaAccountId: null,
        sources: ['default-login'],
        firstSeenMs: 2_000
      }
    ])
    expect(JSON.stringify(state.accounts)).not.toContain('uuid-ada')
  })

  it('joins the default login and Orca’s copy of the same account, and keeps later details', () => {
    const state = emptyLedger(1_000)
    upsertClaudeAccount(state, identity('ada'), 'default-login', 2_000)
    upsertClaudeAccount(state, identity('ada', { organizationName: 'Ada Labs' }), 'orca', 3_000)
    upsertClaudeAccount(state, identity('grace'), 'orca', 3_000)
    expect(state.accounts).toMatchObject([
      {
        key: keyOf('ada'),
        organizationName: 'Ada Labs',
        sources: ['default-login', 'orca'],
        firstSeenMs: 2_000
      },
      { key: keyOf('grace'), sources: ['orca'] }
    ])
  })

  it('links an Orca row by email and organisation together, never by email alone', () => {
    const state = emptyLedger(1_000)
    upsertClaudeAccount(state, identity('ada'), 'default-login', 2_000)
    const row = { id: 'orca-1', email: 'ADA@Example.test', organizationName: 'x' }
    mergeOrcaAccounts(
      state,
      orcaList({ claude: [{ ...row, organizationUuid: 'org-someone-else' }] }),
      3_000
    )
    expect(state.accounts[0].orcaAccountId).toBeNull()
    mergeOrcaAccounts(state, orcaList({ claude: [{ ...row, organizationUuid: 'org-ada' }] }), 3_000)
    expect(state.accounts).toMatchObject([
      { orcaAccountId: 'orca-1', sources: ['default-login', 'orca'], organizationName: 'ada Org' }
    ])
  })

  it('files Orca’s limit readings under the account they belong to, replacing older ones', () => {
    const state = emptyLedger(1_000)
    upsertClaudeAccount(state, identity('ada'), 'default-login', 2_000)
    const claude = [
      { id: 'orca-1', email: 'ada@example.test', organizationUuid: 'org-ada', organizationName: '' }
    ]
    mergeOrcaAccounts(
      state,
      orcaList({
        claude,
        claudeLimits: [
          { orcaAccountId: 'orca-1', limits: [weekly] },
          { orcaAccountId: 'orca-unknown', limits: [weekly] }
        ]
      }),
      3_000
    )
    expect([...state.limits]).toEqual([[keyOf('ada'), [weekly]]])
    mergeOrcaAccounts(
      state,
      orcaList({ claude, claudeLimits: [{ orcaAccountId: 'orca-1', limits: [] }] }),
      4_000
    )
    expect(state.limits.get(keyOf('ada'))).toEqual([])
  })

  it('records the Codex login Orca reports under the key its sessions carry', () => {
    const state = emptyLedger(1_000)
    mergeOrcaAccounts(
      state,
      orcaList({
        codex: {
          providerAccountId: 'acct_1',
          email: 'ada@example.test',
          workspaceLabel: 'Ada Labs',
          limits: [weekly]
        }
      }),
      3_000
    )
    const key = accountKey('codex', 'acct_1')
    expect(state.accounts).toMatchObject([
      {
        key,
        provider: 'codex',
        email: 'ada@example.test',
        organizationName: 'Ada Labs',
        sources: ['orca']
      }
    ])
    expect(state.codexDefaultKey).toBe(key)
    expect(state.limits.get(key)).toEqual([weekly])
    mergeOrcaAccounts(state, orcaList(), 4_000)
    expect(state.codexDefaultKey).toBeNull()
  })
})

describe('setAlias', () => {
  const withAda = () => {
    const state = emptyLedger(1_000)
    upsertClaudeAccount(state, identity('ada'), 'default-login', 2_000)
    return state
  }

  it('names an account, and clears the name when given nothing', () => {
    const state = withAda()
    expect(setAlias(state, keyOf('ada'), '  Work  ')).toEqual({ success: true })
    expect(state.accounts[0].alias).toBe('Work')
    expect(setAlias(state, keyOf('ada'), '   ')).toEqual({ success: true })
    expect(state.accounts[0].alias).toBeNull()
    setAlias(state, keyOf('ada'), 'Work')
    expect(setAlias(state, keyOf('ada'), null)).toEqual({ success: true })
    expect(state.accounts[0].alias).toBeNull()
  })

  it.each([
    ['a number', 7],
    ['an object', { name: 'Work' }],
    ['a name that is too long', 'w'.repeat(MAX_ALIAS_LENGTH + 1)],
    ['a name with a control character', 'Work\u0007']
  ])('refuses %s', (_case, alias) => {
    const state = withAda()
    expect(setAlias(state, keyOf('ada'), alias)).toEqual({
      success: false,
      reason: 'invalid-alias'
    })
    expect(state.accounts[0].alias).toBeNull()
  })

  it.each([['claude:000000000000'], [42], [null], ['__proto__']])(
    'refuses a key it has never recorded: %s',
    (key) => {
      expect(setAlias(withAda(), key, 'Work')).toEqual({
        success: false,
        reason: 'unknown-account'
      })
    }
  )
})
