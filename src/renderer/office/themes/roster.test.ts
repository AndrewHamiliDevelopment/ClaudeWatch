import { describe, expect, it } from 'vitest'
import { makeRoster } from './roster'
import { ROSTER_NAMES_STORAGE_KEY } from './roster-names'

// Two leads per provider, then each provider's squad member.
const CAST = ['ada', 'bo', 'cy', 'di', 'cadet', 'hand'].map((id) => ({
  id,
  name: id.toUpperCase(),
  role: `plays ${id}`,
  costume: 'not for the HUD'
}))
const roster = makeRoster('test-theme', CAST, 2)

describe('makeRoster', () => {
  it('casts a lead by provider and bay, wrapping past the last lead', () => {
    const lead = (provider: 'claude' | 'codex', bay: number) =>
      CAST[roster.indexFor({ provider, isSubagent: false }, bay)].id
    expect([0, 1, 2].map((bay) => lead('claude', bay))).toEqual(['ada', 'bo', 'ada'])
    expect([0, 1, 2].map((bay) => lead('codex', bay))).toEqual(['cy', 'di', 'cy'])
  })

  it('casts a subagent as its provider’s squad member, whatever the bay', () => {
    expect(CAST[roster.indexFor({ provider: 'claude', isSubagent: true }, 3)].id).toBe('cadet')
    expect(CAST[roster.indexFor({ provider: 'codex', isSubagent: true }, 0)].id).toBe('hand')
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
