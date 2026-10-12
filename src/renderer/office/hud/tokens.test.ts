import { describe, expect, it } from 'vitest'
import type { SessionUsage, TokenCounts } from '../../../shared/office/types'
import { makeSession } from '../__tests__/fixtures'
import { buildTokenLedger, formatTokens } from '../../deck/tokens'
import { contextText, memberTokens, tokensText } from './tokens'

const counts = (input: number, output = 0, cacheWrite = 0, cacheRead = 0): TokenCounts => ({
  input,
  output,
  cacheWrite,
  cacheRead
})

const usage = (own: TokenCounts, subagents = counts(0)): SessionUsage => ({
  own,
  subagents,
  spawned: 0,
  contextTokens: null,
  contextLimit: null
})

describe('formatTokens', () => {
  it('keeps two decimals in the billions and one below', () => {
    expect(formatTokens(1_050_000_000)).toBe('1.05B')
    expect(formatTokens(423_600_000)).toBe('423.6M')
    expect(formatTokens(225_000)).toBe('225K')
    expect(formatTokens(999)).toBe('999')
  })
})

describe('tokensText', () => {
  it('says a number that is not known yet is still being counted, never 0', () => {
    expect(tokensText(null)).toBe('counting…')
    expect(tokensText(0)).toBe('0')
  })
})

describe('memberTokens', () => {
  it('adds the four parts of a subagent or teammate', () => {
    expect(memberTokens({ tokens: counts(1, 2, 3, 4) })).toBe(10)
  })

  it('is unknown when the bridge sent no count', () => {
    expect(memberTokens({})).toBeNull()
    expect(memberTokens({ tokens: null })).toBeNull()
  })
})

describe('contextText', () => {
  it('shows the window as an absolute number when its size is unknown', () => {
    expect(contextText({ contextTokens: 225_000, contextLimit: null })).toBe('225K')
  })

  it('adds the share of the window when the limit is known', () => {
    expect(contextText({ contextTokens: 136_000, contextLimit: 272_000 })).toBe('136K of 272K, 50%')
  })

  it('is unknown when the window was not read', () => {
    expect(contextText({ contextTokens: null, contextLimit: 272_000 })).toBeNull()
  })
})

describe('buildTokenLedger', () => {
  const sessions = [
    makeSession({
      key: 'claude:a',
      companyKey: 'c_zk',
      projectKey: 'p_cw',
      usage: usage(counts(100), counts(50))
    }),
    makeSession({ key: 'claude:b', companyKey: 'c_zk', projectKey: 'p_cw', usage: null }),
    makeSession({
      key: 'claude:c',
      companyKey: 'c_zk',
      projectKey: 'p_team',
      usage: usage(counts(7))
    }),
    makeSession({ key: 'codex:d', companyKey: 'c_pa', projectKey: 'p_pa' })
  ]

  it('sums a project from its counted sessions and a company from its projects', () => {
    const ledger = buildTokenLedger(sessions)
    expect(ledger.projects.get('p_cw')).toBe(150)
    expect(ledger.projects.get('p_team')).toBe(7)
    expect(ledger.companies.get('c_zk')).toBe(157)
    expect(ledger.office).toBe(157)
  })

  it('marks every total that still has an uncounted session under it', () => {
    const ledger = buildTokenLedger(sessions)
    expect(ledger.partialProjects.has('p_cw')).toBe(true)
    expect(ledger.partialProjects.has('p_team')).toBe(false)
    expect(ledger.partialCompanies.has('c_zk')).toBe(true)
    expect(ledger.isOfficePartial).toBe(true)
    expect(buildTokenLedger([sessions[0], sessions[2]]).isOfficePartial).toBe(false)
  })

  it('writes a partial total as a floor', () => {
    expect(tokensText(150, true)).toBe('150+')
    expect(tokensText(150)).toBe('150')
    expect(tokensText(null, true)).toBe('counting…')
  })

  it('leaves an office with nothing counted unknown, not 0', () => {
    const ledger = buildTokenLedger(sessions)
    expect(ledger.projects.has('p_pa')).toBe(false)
    expect(ledger.companies.has('c_pa')).toBe(false)
    expect(buildTokenLedger([sessions[3]]).office).toBeNull()
  })
})
