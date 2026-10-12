import { describe, expect, it } from 'vitest'
import '../themes/builtins'
import { EDO } from '../themes/palettes'
import { listThemes } from '../themes/registry'
import { fallbackDress } from './fallback-dress'
import { gardenPiece, placeGardenPiece, type GreenPlot } from './garden-pieces'
import type { GardenRole } from './town-dress'
import { dressOf } from './TownView'

const ROLES: readonly GardenRole[] = ['tree', 'lamp', 'seat', 'feature', 'corner', 'plazaPair']
const BUILT: readonly GardenRole[] = ['feature', 'corner']

function plotFor(role: GardenRole): GreenPlot {
  const size = BUILT.includes(role) ? 5 : 1.6
  return gardenPiece(
    `garden:north:${role}:0`,
    role,
    { x: 0, z: 0, width: size, depth: size },
    {
      facing: 'north',
      zoneId: null,
      maxHeight: 3
    }
  )
}

describe.each(listThemes().map((theme) => [theme.id, theme] as const))(
  'garden of %s',
  (_id, theme) => {
    const dress = dressOf(theme)

    it('names a piece for every role, each one the theme already has', () => {
      expect(dress.garden).toBeDefined()
      for (const role of ROLES) {
        const name = dress.garden?.[role]
        const pool = BUILT.includes(role) ? dress.designs : dress.props
        expect(
          pool.map((piece) => piece.name),
          `${role}: ${name}`
        ).toContain(name)
      }
    })

    it('draws the named piece, the same on every plot of a role', () => {
      for (const role of ROLES) {
        const placed = placeGardenPiece(plotFor(role), 0, dress)
        expect(placed.design).toBe(dress.garden?.[role])
        expect(placed.parts.length).toBeGreaterThan(0)
        const twin = placeGardenPiece({ ...plotFor(role), id: 'garden:south:x:9', x: 30 }, 0, dress)
        expect(twin.parts).toEqual(placed.parts)
        expect(twin.scale).toBe(placed.scale)
      }
    })
  }
)

describe('a dress with no garden of its own', () => {
  const dress = fallbackDress(EDO)

  it('takes a piece for every role by its name', () => {
    expect(dress.garden).toBeUndefined()
    for (const role of ROLES) expect(placeGardenPiece(plotFor(role), 0, dress).design).not.toBe('')
  })
})
