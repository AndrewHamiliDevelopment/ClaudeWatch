import { describe, expect, it } from 'vitest'
import { agentHash, buildFor, LEAD_BUILDS, makeRoster, pickFor, SQUAD_BUILDS } from './roster'
import { ROSTER_NAMES_STORAGE_KEY } from './roster-names'

type Provider = 'claude' | 'codex' | 'opencode'

// Listed out of provider order on purpose: a cast grows by appending, so its factions interleave.
const CAST = (
  [
    ['ada', 'claude', false],
    ['bo', 'claude', false],
    ['cy', 'codex', false],
    ['di', 'codex', false],
    ['cadet', 'claude', true],
    ['hand', 'codex', true],
    ['eve', 'claude', false],
    ['oz', 'opencode', false],
    ['pip', 'opencode', false],
    ['page', 'opencode', true]
  ] as const
).map(([id, provider, isSquad]) => ({
  id,
  name: id.toUpperCase(),
  role: `plays ${id}`,
  provider,
  isSquad
}))
const roster = makeRoster('test-theme', CAST, ({ provider, isSquad }) => ({ provider, isSquad }))
const keys = Array.from({ length: 40 }, (_, index) => `claude:session-${index}`)
const played = (provider: Provider, isSubagent: boolean, agentKey?: string, bay = 0) =>
  CAST[roster.indexFor({ provider, isSubagent, agentKey }, bay)]

describe('agentHash', () => {
  it('gives one key one number, and different keys different numbers', () => {
    expect(agentHash('claude:1')).toBe(agentHash('claude:1'))
    expect(new Set(keys.map(agentHash)).size).toBe(keys.length)
    for (const key of keys)
      expect(Number.isInteger(agentHash(key)) && agentHash(key) >= 0).toBe(true)
  })

  it('picks the same option for a key every time, and a different one per salt somewhere', () => {
    const options = ['a', 'b', 'c', 'd']
    for (const key of keys) expect(pickFor(options, key, 'x')).toBe(pickFor(options, key, 'x'))
    expect(new Set(keys.map((key) => pickFor(options, key, 'x'))).size).toBe(options.length)
    expect(keys.some((key) => pickFor(options, key, 'x') !== pickFor(options, key, 'y'))).toBe(true)
  })
})

describe('makeRoster', () => {
  it('casts a lead from its own provider’s leads, wherever they sit in the cast', () => {
    for (const key of keys) {
      expect(['ada', 'bo', 'eve']).toContain(played('claude', false, key).id)
      expect(['cy', 'di']).toContain(played('codex', false, key).id)
      expect(['oz', 'pip']).toContain(played('opencode', false, key).id)
    }
  })

  it('spreads the agents of one office over every lead of their provider', () => {
    expect(new Set(keys.map((key) => played('claude', false, key).id)).size).toBe(3)
    expect(new Set(keys.map((key) => played('opencode', false, key).id)).size).toBe(2)
  })

  it('keeps an agent’s character for as long as its key and its office stay the same', () => {
    for (const key of keys)
      expect(played('claude', false, key, 2)).toBe(played('claude', false, key, 2))
  })

  it('shifts the whole cast by one from an office to the next', () => {
    const leads = ['ada', 'bo', 'eve']
    for (const key of keys) {
      const here = leads.indexOf(played('claude', false, key, 0).id)
      expect(played('claude', false, key, 1).id).toBe(leads[(here + 1) % leads.length])
    }
  })

  it('casts by office alone when the agent’s key is not known', () => {
    expect([0, 1, 2, 3].map((bay) => played('claude', false, undefined, bay).id)).toEqual([
      'ada',
      'bo',
      'eve',
      'ada'
    ])
  })

  it('casts a subagent as its own provider’s squad member', () => {
    for (const key of keys) {
      expect(played('claude', true, key, 3).id).toBe('cadet')
      expect(played('codex', true, key).id).toBe('hand')
      expect(played('opencode', true, key).id).toBe('page')
    }
  })

  it('refuses a cast that leaves a provider without a lead or a squad member', () => {
    const noSquad = CAST.filter((entry) => entry.id !== 'page')
    expect(() =>
      makeRoster('broken', noSquad, ({ provider, isSquad }) => ({ provider, isSquad }))
    ).toThrow('opencode')
  })

  it('lists id, name and role only, with the owner’s renames applied by index', () => {
    expect(roster.entries({ getItem: () => null })[0]).toEqual({
      id: 'ada',
      name: 'ADA',
      role: 'plays ada'
    })
    const renamed = roster.entries({
      getItem: (key) =>
        key === ROSTER_NAMES_STORAGE_KEY ? JSON.stringify({ 'test-theme': ['Mine'] }) : null
    })
    expect(renamed.map((entry) => entry.name).slice(0, 2)).toEqual(['Mine', 'BO'])
  })
})

describe('buildFor', () => {
  it('gives a lead one of the lead builds and keeps it', () => {
    for (const agentKey of keys) {
      const build = buildFor({ agentKey, isSubagent: false })
      expect(LEAD_BUILDS).toContain(build)
      expect(buildFor({ agentKey, isSubagent: false })).toBe(build)
    }
    expect(new Set(keys.map((agentKey) => buildFor({ agentKey, isSubagent: false }))).size).toBe(
      LEAD_BUILDS.length
    )
  })

  it('builds every subagent smaller than every lead', () => {
    const tallestSquad = Math.max(...SQUAD_BUILDS.map((build) => build.height))
    expect(tallestSquad).toBeLessThan(Math.min(...LEAD_BUILDS.map((build) => build.height)))
    for (const agentKey of keys)
      expect(SQUAD_BUILDS).toContain(buildFor({ agentKey, isSubagent: true }))
  })
})
