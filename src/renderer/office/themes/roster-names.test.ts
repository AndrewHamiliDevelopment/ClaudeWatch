import { describe, expect, it } from 'vitest'
import { ROSTER_NAMES_STORAGE_KEY, rosterName } from './roster-names'

function storageWith(value: unknown) {
  const raw = typeof value === 'string' ? value : JSON.stringify(value)
  return { getItem: (key: string) => (key === ROSTER_NAMES_STORAGE_KEY ? raw : null) }
}

describe('rosterName', () => {
  it('uses the claudewatch.office.roster-names key', () => {
    expect(ROSTER_NAMES_STORAGE_KEY).toBe('claudewatch.office.roster-names')
  })

  it('returns the shipped name when nothing is stored', () => {
    expect(rosterName('violet-court', 0, 'Aurel Vane', { getItem: () => null })).toBe('Aurel Vane')
    expect(rosterName('violet-court', 0, 'Aurel Vane', null)).toBe('Aurel Vane')
  })

  it("returns the owner's name for that theme and index", () => {
    const storage = storageWith({ 'violet-court': ['Commander', 'Ace'] })
    expect(rosterName('violet-court', 1, 'Sable Rooke', storage)).toBe('Ace')
    expect(rosterName('violet-court', 2, 'Ilse Marrow', storage)).toBe('Ilse Marrow')
    expect(rosterName('another-theme', 0, 'Default', storage)).toBe('Default')
  })

  it('caps a stored name at 40 characters and trims it', () => {
    const storage = storageWith({ court: [`  ${'x'.repeat(60)}  `, '   '] })
    expect(rosterName('court', 0, 'Default', storage)).toBe('x'.repeat(40))
    expect(rosterName('court', 1, 'Default', storage)).toBe('Default')
  })

  it('ignores stored values of the wrong type', () => {
    for (const stored of [
      'not json {',
      42,
      null,
      ['Ace'],
      { court: 'Ace' },
      { court: { 0: 'Ace' } },
      { court: [7, null, { name: 'Ace' }] }
    ]) {
      const storage = storageWith(stored)
      for (const index of [0, 1, 2])
        expect(rosterName('court', index, 'Default', storage)).toBe('Default')
    }
  })

  it('reads own members only and rejects indexes outside the list', () => {
    const storage = storageWith({ court: ['Ace'] })
    expect(rosterName('constructor', 0, 'Default', storage)).toBe('Default')
    expect(rosterName('court', -1, 'Default', storage)).toBe('Default')
    expect(rosterName('court', 0.5, 'Default', storage)).toBe('Default')
  })

  it('falls back to the shipped name when storage throws', () => {
    const locked = {
      getItem: (): string => {
        throw new Error('denied')
      }
    }
    expect(rosterName('court', 0, 'Default', locked)).toBe('Default')
  })
})
