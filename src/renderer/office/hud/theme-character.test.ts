import { describe, expect, it } from 'vitest'
import { violetCourtRoster } from '../themes/violet-court'
import { characterFor } from './theme-character'

describe('characterFor', () => {
  const lead = { provider: 'claude', isSubagent: false } as const

  it('names the Violet Court character an agent plays, by provider and office bay', () => {
    const roster = violetCourtRoster(null)
    expect(characterFor('violet-court', lead, 0)).toEqual(roster[0])
    expect(characterFor('violet-court', lead, 1)).toEqual(roster[1])
    expect(characterFor('violet-court', { provider: 'codex', isSubagent: false }, 0)).toEqual(
      roster[5]
    )
  })

  it('has no character for a theme without a cast', () => {
    expect(characterFor('neo-edo-steam', lead, 0)).toBeNull()
    expect(characterFor('brass-workshop', lead, 3)).toBeNull()
  })
})
