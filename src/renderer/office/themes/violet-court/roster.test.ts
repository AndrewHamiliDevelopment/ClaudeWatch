import { describe, expect, it } from 'vitest'
import { ROSTER_NAMES_STORAGE_KEY } from '../roster-names'
import { COURT_CAST } from './cast'
import { COURT_FRAMES, frameForBay, violetCourtRoster } from './roster'

type Provider = 'claude' | 'codex' | 'opencode'
const PROVIDERS = ['claude', 'codex', 'opencode'] as const
const lead = (provider: Provider, bay: number) =>
  COURT_CAST[violetCourtRoster.indexFor({ provider, isSubagent: false }, bay)]
const squad = (provider: Provider, bay: number) =>
  COURT_CAST[violetCourtRoster.indexFor({ provider, isSubagent: true }, bay)]

describe('Violet Court roster', () => {
  it('names at least eight distinct characters, each with a one-line role', () => {
    const leads = COURT_CAST.filter((character) => !character.isSquad)
    expect(leads.length).toBeGreaterThanOrEqual(8)
    const all = [...COURT_CAST, ...COURT_FRAMES]
    for (const entry of all) {
      expect(entry.id).toMatch(/^[a-z][a-z-]+$/)
      expect(entry.name.trim().length).toBeGreaterThan(2)
      expect(entry.role.trim().length).toBeGreaterThan(10)
      expect(entry.role).not.toContain('\n')
    }
    expect(new Set(all.map((entry) => entry.id)).size).toBe(all.length)
    expect(new Set(all.map((entry) => entry.name)).size).toBe(all.length)
  })

  it('gives the first eight bays of one provider eight different characters, then wraps', () => {
    for (const provider of PROVIDERS) {
      const ids = [0, 1, 2, 3, 4, 5, 6, 7].map((bay) => lead(provider, bay).id)
      expect(new Set(ids).size).toBe(8)
      expect(lead(provider, 8).id).toBe(ids[0])
    }
  })

  it('puts each provider in a faction of its own', () => {
    for (const bay of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(lead('claude', bay).faction).toBe('order')
      expect(lead('codex', bay).faction).toBe('corps')
      expect(lead('opencode', bay).faction).toBe('guild')
    }
  })

  it('casts subagents as their faction squad member whatever the bay', () => {
    for (const bay of [0, 3, 7]) {
      expect(squad('claude', bay)).toMatchObject({ isSquad: true, faction: 'order' })
      expect(squad('codex', bay)).toMatchObject({ isSquad: true, faction: 'corps' })
      expect(squad('opencode', bay)).toMatchObject({ isSquad: true, faction: 'guild' })
    }
    expect(squad('claude', 0)).toBe(squad('claude', 4))
  })

  // The owner's local renames are stored by index: a founder never moves.
  it('keeps the founding cast at the indexes it shipped with', () => {
    expect(COURT_CAST.slice(0, 12).map((character) => character.id)).toEqual([
      'aurel-vane',
      'sable-rooke',
      'ilse-marrow',
      'tobin-cask',
      'wren-halloway',
      'odette-vey',
      'garrick-hobb',
      'lucan-albright',
      'mirelle-dane',
      'tamsin-roe',
      'violet-squire',
      'lance-cadet'
    ])
  })

  it('parks one of the three knight frames in every bay', () => {
    expect(COURT_FRAMES.map((frame) => frame.kind)).toEqual(['command', 'vanguard', 'lancer'])
    expect([0, 1, 2, 3].map((bay) => frameForBay(bay).kind)).toEqual([
      'command',
      'vanguard',
      'lancer',
      'command'
    ])
    expect(frameForBay(undefined).kind).toBe('command')
  })

  it('exports id, name and role, with the owner local renames applied by index', () => {
    const shipped = violetCourtRoster.entries({ getItem: () => null })
    expect(shipped).toHaveLength(COURT_CAST.length)
    expect(shipped[0]).toEqual({
      id: COURT_CAST[0].id,
      name: COURT_CAST[0].name,
      role: COURT_CAST[0].role
    })
    const renamed = violetCourtRoster.entries({
      getItem: (key) =>
        key === ROSTER_NAMES_STORAGE_KEY ? JSON.stringify({ 'violet-court': ['My Regent'] }) : null
    })
    expect(renamed[0].name).toBe('My Regent')
    expect(renamed[1].name).toBe(COURT_CAST[1].name)
  })
})
