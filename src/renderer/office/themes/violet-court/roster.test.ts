import { describe, expect, it } from 'vitest'
import { ROSTER_NAMES_STORAGE_KEY } from '../roster-names'
import { COURT_CAST } from './cast'
import { castIndexFor, COURT_FRAMES, frameForBay, violetCourtRoster } from './roster'

const lead = (provider: 'claude' | 'codex', bay: number) =>
  COURT_CAST[castIndexFor({ provider, isSubagent: false }, bay)]
const squad = (provider: 'claude' | 'codex', bay: number) =>
  COURT_CAST[castIndexFor({ provider, isSubagent: true }, bay)]

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

  it('gives the first five bays of one provider five different characters, then wraps', () => {
    for (const provider of ['claude', 'codex'] as const) {
      const ids = [0, 1, 2, 3, 4].map((bay) => lead(provider, bay).id)
      expect(new Set(ids).size).toBe(5)
      expect(lead(provider, 5).id).toBe(ids[0])
    }
  })

  it('puts a Claude session and a Codex session in different factions', () => {
    for (const bay of [0, 1, 2, 3, 4, 5, 6]) {
      expect(lead('claude', bay).faction).toBe('order')
      expect(lead('codex', bay).faction).toBe('corps')
    }
  })

  it('casts subagents as their faction squad member whatever the bay', () => {
    for (const bay of [0, 3, 7]) {
      expect(squad('claude', bay)).toMatchObject({ isSquad: true, faction: 'order' })
      expect(squad('codex', bay)).toMatchObject({ isSquad: true, faction: 'corps' })
    }
    expect(squad('claude', 0)).toBe(squad('claude', 4))
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
    const shipped = violetCourtRoster({ getItem: () => null })
    expect(shipped).toHaveLength(COURT_CAST.length)
    expect(shipped[0]).toEqual({
      id: COURT_CAST[0].id,
      name: COURT_CAST[0].name,
      role: COURT_CAST[0].role
    })
    const renamed = violetCourtRoster({
      getItem: (key) =>
        key === ROSTER_NAMES_STORAGE_KEY ? JSON.stringify({ 'violet-court': ['My Regent'] }) : null
    })
    expect(renamed[0].name).toBe('My Regent')
    expect(renamed[1].name).toBe(COURT_CAST[1].name)
  })
})
