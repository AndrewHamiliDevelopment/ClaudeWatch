import { describe, expect, it } from 'vitest'
import { ROSTER_NAMES_STORAGE_KEY } from '../roster-names'
import { GROVE_CAST } from './cast'
import { quietGroveRoster } from './roster'

type Provider = 'claude' | 'codex' | 'opencode'
const PROVIDERS = ['claude', 'codex', 'opencode'] as const
const lead = (provider: Provider, bay: number) =>
  GROVE_CAST[quietGroveRoster.indexFor({ provider, isSubagent: false }, bay)]
const sprout = (provider: Provider, bay: number) =>
  GROVE_CAST[quietGroveRoster.indexFor({ provider, isSubagent: true }, bay)]

describe('Quiet Grove roster', () => {
  it('names at least eight distinct lead characters, each with a one-line role', () => {
    expect(GROVE_CAST.filter((character) => !character.isSprout).length).toBeGreaterThanOrEqual(8)
    for (const entry of GROVE_CAST) {
      expect(entry.id).toMatch(/^[a-z][a-z-]+$/)
      expect(entry.name.trim().length).toBeGreaterThan(2)
      expect(entry.role.trim().length).toBeGreaterThan(10)
      expect(entry.role).not.toContain('\n')
    }
    expect(new Set(GROVE_CAST.map((entry) => entry.id)).size).toBe(GROVE_CAST.length)
    expect(new Set(GROVE_CAST.map((entry) => entry.name)).size).toBe(GROVE_CAST.length)
  })

  it('gives the first eight bays of one provider eight different characters, then wraps', () => {
    for (const provider of PROVIDERS) {
      const ids = [0, 1, 2, 3, 4, 5, 6, 7].map((bay) => lead(provider, bay).id)
      expect(new Set(ids).size).toBe(8)
      expect(lead(provider, 8).id).toBe(ids[0])
    }
  })

  it('casts Claude as a keeper, Codex as a helper and OpenCode as a wanderer', () => {
    for (const bay of [0, 1, 2, 3, 4, 5, 6, 7, 8]) {
      expect(lead('claude', bay)).toMatchObject({ kin: 'keeper', isSprout: false })
      expect(lead('codex', bay)).toMatchObject({ kin: 'helper', isSprout: false })
      expect(lead('opencode', bay)).toMatchObject({ kin: 'wanderer', isSprout: false })
    }
  })

  it('casts subagents and teammates as the sprout of their lead kin, whatever the bay', () => {
    for (const bay of [0, 3, 7]) {
      expect(sprout('claude', bay)).toMatchObject({ isSprout: true, kin: 'keeper' })
      expect(sprout('codex', bay)).toMatchObject({ isSprout: true, kin: 'helper' })
      expect(sprout('opencode', bay)).toMatchObject({ isSprout: true, kin: 'wanderer' })
    }
    expect(sprout('claude', 0)).toBe(sprout('claude', 4))
  })

  // The owner's local renames are stored by index: a founder never moves.
  it('keeps the founding cast at the indexes it shipped with', () => {
    expect(GROVE_CAST.slice(0, 12).map((character) => character.id)).toEqual([
      'tansy-rushlight',
      'bracken-holt',
      'linden-quill',
      'sorrel-wick',
      'alder-moss',
      'pebble-brook',
      'flint-burrow',
      'drizzle-fen',
      'cobble-wren',
      'nettle-tarn',
      'hearth-sprout',
      'brook-sapling'
    ])
  })

  it('exports id, name and role, with the owner local renames applied by index', () => {
    const shipped = quietGroveRoster.entries({ getItem: () => null })
    expect(shipped).toHaveLength(GROVE_CAST.length)
    expect(shipped[0]).toEqual({
      id: GROVE_CAST[0].id,
      name: GROVE_CAST[0].name,
      role: GROVE_CAST[0].role
    })
    const renamed = quietGroveRoster.entries({
      getItem: (key) =>
        key === ROSTER_NAMES_STORAGE_KEY ? JSON.stringify({ 'quiet-grove': ['My Keeper'] }) : null
    })
    expect(renamed[0].name).toBe('My Keeper')
    expect(renamed[1].name).toBe(GROVE_CAST[1].name)
  })
})
