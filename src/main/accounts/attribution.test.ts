import { describe, expect, it } from 'vitest'
import { accountKey } from '../../bridge/account-key'
import { session } from '../../bridge/__fixtures__/helpers'
import type { UsageDelta } from '../../shared/accounts'
import type { SessionRef } from '../../shared/office/types'
import { countCodexSessions, countUsage, prune, recordIdentity } from './attribution'
import type { IdentityRead } from './identity'
import { emptyLedger, type LedgerState, RETENTION_MS } from './ledger-state'

// Local wall-clock times on one day, so day buckets do not depend on the machine's zone.
const at = (hour: number, minute = 0, second = 0): number =>
  new Date(2026, 9, 11, hour, minute, second).getTime()
const DAY = '2026-10-11'
const signedIn = (name: string): IdentityRead => ({
  status: 'signed-in',
  identity: {
    accountUuid: `uuid-${name}`,
    organizationUuid: `org-${name}`,
    emailAddress: `${name}@example.test`,
    organizationName: `${name} Org`,
    organizationRateLimitTier: 'max'
  }
})
const keyOf = (name: string): string => accountKey('claude', `uuid-${name}`)
const output = (value: number) => ({ input: 0, output: value, cacheWrite: 0, cacheRead: 0 })
const line = (atMs: number, tokens: number, file = '/p/a.jsonl'): UsageDelta => ({
  sessionKey: 'claude:a',
  projectKey: 'p_repo',
  projectLabel: 'repo',
  file,
  atMs,
  counts: output(tokens)
})
// What the ledger holds, as [account, confidence, output tokens].
const held = (state: LedgerState): [string | null, string, number][] =>
  [...state.buckets.values()].map((bucket) => [
    bucket.accountKey,
    bucket.confidence,
    bucket.counts.output
  ])
// A ledger that has watched `name` continuously from 10:00 until `until`.
function watching(name: string, until = at(10)): LedgerState {
  const state = emptyLedger(at(9))
  for (let time = at(10); time <= until; time += 15_000) recordIdentity(state, signedIn(name), time)
  return state
}

describe('usage on the shared login', () => {
  it('goes to the account that was signed in when each line was written', () => {
    const state = watching('ada', at(10, 30))
    recordIdentity(state, signedIn('grace'), at(10, 30, 15))
    countUsage(state, [line(at(10, 10), 5), line(at(10, 40), 7)], at(10, 41))
    expect(held(state)).toEqual([
      [keyOf('ada'), 'inferred', 5],
      [keyOf('grace'), 'inferred', 7]
    ])
    expect([...state.buckets.values()][0]).toMatchObject({ day: DAY, projectKey: 'p_repo' })
    expect(state.projects.get('p_repo')).toBe('repo')
  })

  it('bridges a gap in watching when the same account is signed in afterwards', () => {
    const state = watching('ada')
    recordIdentity(state, signedIn('ada'), at(12))
    countUsage(state, [line(at(11), 5)], at(12, 1))
    expect(held(state)).toEqual([[keyOf('ada'), 'inferred', 5]])
  })

  it('leaves usage unattributed when another account is signed in after a gap', () => {
    const state = watching('ada', at(10, 1))
    recordIdentity(state, signedIn('grace'), at(12))
    countUsage(state, [line(at(10, 0, 30), 1), line(at(11), 5), line(at(12, 1), 7)], at(12, 2))
    expect(held(state)).toEqual([
      [keyOf('ada'), 'inferred', 1],
      [null, 'unattributed', 5],
      [keyOf('grace'), 'inferred', 7]
    ])
  })

  it('attributes nothing while signed out, and keeps its place through an unreadable read', () => {
    const state = watching('ada', at(10, 1))
    recordIdentity(state, { status: 'unreadable' }, at(10, 1, 15))
    countUsage(state, [line(at(10, 1, 20), 3)], at(10, 2))
    recordIdentity(state, { status: 'signed-out' }, at(10, 2, 15))
    countUsage(state, [line(at(10, 5), 4)], at(10, 6))
    expect(held(state)).toEqual([
      [keyOf('ada'), 'inferred', 3],
      [null, 'unattributed', 4]
    ])
  })

  it('counts nothing from before tracking began', () => {
    const state = watching('ada')
    expect(countUsage(state, [line(at(8, 59), 100)], at(10, 1))).toBe(false)
    expect(held(state)).toEqual([])
  })
})

describe('counting each line once', () => {
  it('ignores a transcript that is reported again from its first line', () => {
    const state = watching('ada', at(10, 30))
    const first = [line(at(10, 10), 5), line(at(10, 11), 2)]
    expect(countUsage(state, first, at(10, 12))).toBe(true)
    expect(countUsage(state, first, at(10, 13))).toBe(false)
    countUsage(state, [...first, line(at(10, 20), 1)], at(10, 21))
    expect(held(state)).toEqual([[keyOf('ada'), 'inferred', 8]])
  })

  it('keeps one place per transcript, so an older line in another file still counts', () => {
    const state = watching('ada', at(10, 30))
    countUsage(state, [line(at(10, 20), 5, '/p/a.jsonl')], at(10, 21))
    countUsage(state, [line(at(10, 10), 2, '/p/agent.jsonl')], at(10, 22))
    expect(held(state)).toEqual([[keyOf('ada'), 'inferred', 7]])
  })

  it('counts lines that share a timestamp when they arrive together', () => {
    const state = watching('ada', at(10, 30))
    countUsage(state, [line(at(10, 10), 5), line(at(10, 10), 2)], at(10, 11))
    expect(held(state)).toEqual([[keyOf('ada'), 'inferred', 7]])
  })

  it('still refuses old lines after a quiet transcript has been forgotten', () => {
    const state = watching('ada', at(10, 30))
    const old = line(at(10, 10), 5)
    countUsage(state, [old], at(10, 11))
    const later = at(10, 11) + RETENTION_MS + 60_000
    recordIdentity(state, signedIn('ada'), later)
    prune(state, later)
    expect(state.files.size).toBe(0)
    countUsage(state, [old, line(later, 2)], later + 1_000)
    expect(held(state).map(([, , tokens]) => tokens)).toEqual([5, 2])
  })
})

describe('Codex sessions', () => {
  const codexKey = accountKey('codex', 'acct_1')
  const codex = (tokens: number | null, overrides: Partial<SessionRef> = {}): SessionRef => ({
    ...session('c'),
    key: 'codex:c',
    provider: 'codex',
    startedAtMs: at(9, 30),
    accountKey: codexKey,
    accountConfidence: 'exact',
    usage:
      tokens === null
        ? null
        : {
            own: output(tokens),
            subagents: output(0),
            spawned: 0,
            contextTokens: null,
            contextLimit: null
          },
    ...overrides
  })

  it('counts the growth of a running total once, exactly, under the account the session names', () => {
    const state = emptyLedger(at(9))
    expect(countCodexSessions(state, [codex(null)], at(10))).toBe(false)
    expect(countCodexSessions(state, [codex(40)], at(10, 1))).toBe(true)
    expect(countCodexSessions(state, [codex(40)], at(10, 2))).toBe(false)
    countCodexSessions(state, [codex(65)], at(10, 3))
    expect(held(state)).toEqual([[codexKey, 'exact', 65]])
    expect(state.accounts).toMatchObject([
      { key: codexKey, provider: 'codex', sources: ['codex-rollout'] }
    ])
  })

  it('never counts a total twice when it dips and recovers', () => {
    const state = emptyLedger(at(9))
    for (const tokens of [40, 10, 40, 50]) countCodexSessions(state, [codex(tokens)], at(10))
    expect(held(state)).toEqual([[codexKey, 'exact', 50]])
  })

  it('starts a session that is older than tracking from what it had already spent', () => {
    const state = emptyLedger(at(9))
    const older = { startedAtMs: at(8) }
    countCodexSessions(state, [codex(900, older)], at(10))
    countCodexSessions(state, [codex(905, older)], at(10, 1))
    expect(held(state)).toEqual([[codexKey, 'exact', 5]])
  })

  it('leaves a session that names no account unattributed', () => {
    const state = emptyLedger(at(9))
    countCodexSessions(state, [codex(12, { accountKey: null })], at(10))
    expect(held(state)).toEqual([[null, 'unattributed', 12]])
    expect(state.accounts).toEqual([])
  })

  it('leaves Claude sessions to the transcript lines, which carry their own times', () => {
    const state = emptyLedger(at(9))
    const claude = { ...codex(12), key: 'claude:a', provider: 'claude' as const }
    expect(countCodexSessions(state, [claude], at(10))).toBe(false)
  })
})
