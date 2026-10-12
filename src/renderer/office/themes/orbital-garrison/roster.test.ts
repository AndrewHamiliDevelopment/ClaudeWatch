import { describe, expect, it } from 'vitest'
import { ROSTER_NAMES_STORAGE_KEY } from '../roster-names'
import { GARRISON_CAST } from './cast'
import {
  dressingForBay,
  GARRISON_FRAMES,
  ORBITAL_GARRISON_ID,
  orbitalGarrisonRoster
} from './roster'

type Provider = 'claude' | 'codex' | 'opencode'
const PROVIDERS = ['claude', 'codex', 'opencode'] as const
const lead = (provider: Provider, bay: number) =>
  GARRISON_CAST[orbitalGarrisonRoster.indexFor({ provider, isSubagent: false }, bay)]
const squad = (provider: Provider, bay: number) =>
  GARRISON_CAST[orbitalGarrisonRoster.indexFor({ provider, isSubagent: true }, bay)]

describe('Orbital Garrison roster', () => {
  it('names at least eight distinct characters, each with a one-line role', () => {
    const leads = GARRISON_CAST.filter((character) => !character.isSquad)
    expect(leads.length).toBeGreaterThanOrEqual(8)
    const all = [...GARRISON_CAST, ...GARRISON_FRAMES]
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

  it('seats Claude as the flight wing, Codex as the deck crew and OpenCode as the signals', () => {
    for (const bay of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(lead('claude', bay).section).toBe('wing')
      expect(lead('codex', bay).section).toBe('deck')
      expect(lead('opencode', bay).section).toBe('signal')
    }
  })

  it('casts subagents as their section squad member whatever the bay', () => {
    for (const bay of [0, 3, 7]) {
      expect(squad('claude', bay)).toMatchObject({ isSquad: true, section: 'wing' })
      expect(squad('codex', bay)).toMatchObject({ isSquad: true, section: 'deck' })
      expect(squad('opencode', bay)).toMatchObject({ isSquad: true, section: 'signal' })
    }
    expect(squad('claude', 0)).toBe(squad('claude', 4))
  })

  // The owner's local renames are stored by index: a founder never moves.
  it('keeps the founding cast at the indexes it shipped with', () => {
    expect(GARRISON_CAST.slice(0, 12).map((character) => character.id)).toEqual([
      'idris-calloway',
      'noor-vasquez',
      'bram-okafor',
      'suvi-lindqvist',
      'dara-whitlock',
      'hollis-varga',
      'pim-arkwright',
      'odalys-ferro',
      'tavi-renko',
      'josune-abara',
      'wing-cadet',
      'deckhand'
    ])
  })

  it('gives the lead office the bridge and parks a frame in every other bay', () => {
    expect(GARRISON_FRAMES.map((frame) => frame.kind)).toEqual(['trooper', 'heavy', 'scout'])
    expect([0, 1, 2, 3, 4].map(dressingForBay)).toEqual([
      'bridge',
      'trooper',
      'heavy',
      'scout',
      'trooper'
    ])
    // A team room has no bay: it gets a frame, never a second bridge.
    expect(dressingForBay(undefined)).toBe('trooper')
  })

  it('exports id, name and role, with the owner local renames applied by index', () => {
    const shipped = orbitalGarrisonRoster.entries({ getItem: () => null })
    expect(shipped).toHaveLength(GARRISON_CAST.length)
    expect(shipped[0]).toEqual({
      id: GARRISON_CAST[0].id,
      name: GARRISON_CAST[0].name,
      role: GARRISON_CAST[0].role
    })
    const renamed = orbitalGarrisonRoster.entries({
      getItem: (key) =>
        key === ROSTER_NAMES_STORAGE_KEY
          ? JSON.stringify({ [ORBITAL_GARRISON_ID]: ['My Commander'] })
          : null
    })
    expect(renamed[0].name).toBe('My Commander')
    expect(renamed[1].name).toBe(GARRISON_CAST[1].name)
  })
})
