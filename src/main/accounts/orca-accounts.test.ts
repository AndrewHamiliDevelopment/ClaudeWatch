import { describe, expect, it, vi } from 'vitest'
import { listOrcaAccounts, parseOrcaAccountList } from './orca-accounts'

const CANARY = 'CANARY_TOKEN'
const window = (usedPercent: number, windowMinutes: number, resetsAt = 9_000): unknown => ({
  usedPercent,
  windowMinutes,
  resetsAt,
  resetDescription: `resets ${CANARY}`
})
const limits = (updatedAt: number): Record<string, unknown> => ({
  provider: 'claude',
  status: 'error',
  error: CANARY,
  updatedAt,
  session: window(40, 300),
  weekly: window(12, 10080),
  fableWeekly: window(3, 10080),
  usageMetadata: { credentialSource: CANARY, authProvenance: CANARY }
})
const account = (name: string): Record<string, unknown> => ({
  id: `orca-${name}`,
  email: `${name}@example.test`,
  organizationUuid: `org-${name}`,
  organizationName: `${name} Org`,
  authMethod: 'subscription-oauth',
  token: CANARY
})
const response = (result: Record<string, unknown>): string =>
  JSON.stringify({ id: '1', ok: true, result })
const full = (): Record<string, unknown> => ({
  claude: { accounts: [account('ada'), account('grace')], activeAccountId: 'orca-ada' },
  codex: {
    accounts: [],
    activeAccountId: null,
    systemDefault: {
      hasAuth: true,
      authKind: 'chatgpt',
      email: 'ada@example.test',
      providerAccountId: 'acct_1',
      workspaceLabel: 'Ada Labs'
    }
  },
  rateLimits: {
    claude: limits(5_000),
    inactiveClaudeAccounts: [
      { accountId: 'orca-grace', isFetching: false, updatedAt: 4_000, rateLimits: limits(3_000) }
    ],
    codex: {
      provider: 'codex',
      status: 'ok',
      updatedAt: 6_000,
      session: null,
      weekly: window(7, 10080)
    },
    grokAuthConfigured: false
  }
})
const limit = (
  windowMinutes: number,
  usedPercent: number,
  fetchedAtMs: number,
  scope: string | null = null
): unknown => ({
  windowMinutes,
  scope,
  usedPercent,
  resetsAtMs: 9_000,
  source: 'orca-cache',
  fetchedAtMs
})

describe('parseOrcaAccountList', () => {
  it('keeps accounts, the Codex login and each limit window with the time it was read', () => {
    expect(parseOrcaAccountList(response(full()))).toEqual({
      claude: [
        {
          id: 'orca-ada',
          email: 'ada@example.test',
          organizationUuid: 'org-ada',
          organizationName: 'ada Org'
        },
        {
          id: 'orca-grace',
          email: 'grace@example.test',
          organizationUuid: 'org-grace',
          organizationName: 'grace Org'
        }
      ],
      claudeLimits: [
        {
          orcaAccountId: 'orca-ada',
          limits: [
            limit(300, 40, 5_000),
            limit(10080, 12, 5_000),
            limit(10080, 3, 5_000, 'fableWeekly')
          ]
        },
        {
          orcaAccountId: 'orca-grace',
          limits: [
            limit(300, 40, 3_000),
            limit(10080, 12, 3_000),
            limit(10080, 3, 3_000, 'fableWeekly')
          ]
        }
      ],
      codex: {
        providerAccountId: 'acct_1',
        email: 'ada@example.test',
        workspaceLabel: 'Ada Labs',
        limits: [limit(10080, 7, 6_000)]
      }
    })
  })

  it('drops every key it does not name, so a token in the response cannot survive', () => {
    expect(JSON.stringify(parseOrcaAccountList(response(full())))).not.toContain(CANARY)
  })

  it('rejects an account that lacks its organisation, and a window that is not numbers', () => {
    const result = full()
    result.claude = {
      accounts: [{ ...account('ada'), organizationUuid: undefined }, account('grace')],
      activeAccountId: 'orca-grace'
    }
    result.rateLimits = {
      claude: { updatedAt: 5_000, session: window(Number.NaN, 300), weekly: { usedPercent: '12' } }
    }
    const parsed = parseOrcaAccountList(response(result))
    expect(parsed?.claude.map((row) => row.id)).toEqual(['orca-grace'])
    expect(parsed?.claudeLimits).toEqual([{ orcaAccountId: 'orca-grace', limits: [] }])
  })

  it('reports no Codex login when Orca has none', () => {
    const result = full()
    result.codex = { accounts: [], systemDefault: { hasAuth: false, providerAccountId: 'acct_1' } }
    expect(parseOrcaAccountList(response(result))?.codex).toBeNull()
  })

  it.each([
    ['a failure', JSON.stringify({ ok: false, error: 'no runtime' })],
    ['a response with no result', JSON.stringify({ ok: true })],
    ['text that is not JSON', 'Orca is not running'],
    ['an empty answer', '']
  ])('treats %s as unavailable', (_case, stdout) => {
    expect(parseOrcaAccountList(stdout)).toBeNull()
  })
})

describe('listOrcaAccounts', () => {
  it('runs the one read-only command, with fixed arguments', async () => {
    const exec = vi.fn(async () => response(full()))
    expect((await listOrcaAccounts(exec))?.claude).toHaveLength(2)
    expect(exec.mock.calls).toEqual([[['account', 'list', '--json']]])
  })

  it('is unavailable when Orca cannot be run or trusted', async () => {
    const exec = vi.fn(async () => {
      throw new Error('Orca is not signed by its expected team')
    })
    expect(await listOrcaAccounts(exec)).toBeNull()
  })
})
