import { describe, expect, it } from 'vitest'
import type { ZoneGeometry } from '../scene-model'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import type { GreenPlot } from './garden-pieces'
import { campusClaim, neededClaim } from './town-claim'
import { campusGreen } from './town-green'
import { townBlocks } from './town-plan'
import { edges, overlapping, roadStrip, widened } from './town.test-utils'

// Written out again: the belt starts inside the 10 m boulevard and is sure of 3 m more.
const BOULEVARD_M = 10
const RING_M = 13
// The plaza and the campus street keep this band of the west and east sides.
const GATE_BAND_M = 12
const NEAR = 0.01

type Side = 'north' | 'south' | 'west' | 'east'

function everyZone(zones: readonly ZoneGeometry[]): ZoneGeometry[] {
  return zones.flatMap((zone) => [zone, ...everyZone(zone.children)])
}

const sideOf = (piece: GreenPlot): Side => piece.id.split(':')[1] as Side
const isAlongX = (side: Side): boolean => side === 'north' || side === 'south'

describe.each(LIVE_FLOORS)('campusGreen: %s', (_name, floor) => {
  const plan = townBlocks(campusClaim(neededClaim(floor), null), 'full')
  const pieces = campusGreen(floor, plan)
  const claim = edges(plan.claim)
  const belt = pieces.filter((piece) => piece.id.startsWith('garden:'))
  const rows = belt.filter((piece) => piece.role !== 'feature' && piece.role !== 'corner')
  const along = (piece: GreenPlot): number => (isAlongX(sideOf(piece)) ? piece.x : piece.z)
  // A side's runs: north and south whole, west and east either side of the gate band.
  const runsOf = (side: Side): { middle: number; pieces: GreenPlot[] }[] => {
    const onSide = belt.filter((piece) => sideOf(piece) === side && piece.role !== 'corner')
    if (isAlongX(side)) return [{ middle: (claim.west + claim.east) / 2, pieces: onSide }]
    return [
      {
        middle: (claim.north + RING_M - GATE_BAND_M) / 2,
        pieces: onSide.filter((piece) => piece.z < 0)
      },
      {
        middle: (claim.south - RING_M + GATE_BAND_M) / 2,
        pieces: onSide.filter((piece) => piece.z > 0)
      }
    ]
  }
  const SIDES: readonly Side[] = ['north', 'south', 'west', 'east']

  it('sets a row of trees, lamps and seats along north and south, and pieces on west and east', () => {
    for (const side of SIDES) {
      const roles = new Set<string>(
        rows.filter((piece) => sideOf(piece) === side).map((p) => p.role)
      )
      const wanted = isAlongX(side) ? ['lamp', 'seat', 'tree'] : ['seat']
      for (const role of wanted) expect(roles.has(role), `${side} ${role}`).toBe(true)
    }
  })

  it('keeps the garden inside the prop share of the lot cap', () => {
    expect(pieces.length).toBeLessThanOrEqual(80)
  })

  it('mirrors every run about its own middle', () => {
    for (const side of SIDES)
      for (const run of runsOf(side))
        for (const piece of run.pieces) {
          const mirrored = 2 * run.middle - along(piece)
          const twin = run.pieces.find(
            (other) =>
              other.role === piece.role &&
              Math.abs(along(other) - mirrored) < NEAR &&
              Math.abs(
                (isAlongX(side) ? other.z : other.x) - (isAlongX(side) ? piece.z : piece.x)
              ) < NEAR
          )
          expect(twin, `${piece.id} has no mirror`).toBeDefined()
        }
  })

  it('matches opposite sides piece for piece', () => {
    const plan2 = (side: Side): string[] =>
      belt
        .filter((piece) => sideOf(piece) === side && piece.role !== 'corner')
        .map((piece) => `${piece.role}@${along(piece).toFixed(2)}`)
        .sort()
    expect(plan2('north')).toEqual(plan2('south'))
    expect(plan2('west')).toEqual(plan2('east'))
  })

  it('pitches trees evenly, and lamps at twice that, between the trees', () => {
    for (const side of SIDES)
      for (const run of runsOf(side)) {
        const at = (role: string): number[] =>
          run.pieces
            .filter((piece) => piece.role === role)
            .map(along)
            .sort((a, b) => a - b)
        const trees = at('tree')
        if (trees.length < 2) continue
        const pitch = trees[1] - trees[0]
        trees.slice(1).forEach((tree, index) => expect(tree - trees[index]).toBeCloseTo(pitch, 2))
        const lamps = at('lamp')
        lamps.slice(1).forEach((lamp, index) => expect(lamp - lamps[index]).toBeCloseTo(2 * pitch))
        for (const lamp of lamps)
          expect(trees.some((tree) => Math.abs(tree + pitch / 2 - lamp) < NEAR)).toBe(true)
      }
  })

  it('makes every piece of a row the same size and height', () => {
    for (const side of SIDES)
      for (const role of ['tree', 'lamp', 'seat']) {
        const row = rows.filter((piece) => sideOf(piece) === side && piece.role === role)
        if (row.length === 0) continue
        expect(new Set(row.map((p) => `${p.width}x${p.depth}x${p.maxHeight}`)).size).toBe(1)
      }
  })

  it('puts a matching piece at all four corners', () => {
    const corners = belt.filter((piece) => piece.role === 'corner')
    expect(corners).toHaveLength(4)
    const middle = { x: (claim.west + claim.east) / 2, z: (claim.north + claim.south) / 2 }
    for (const corner of corners) {
      const twinX = corners.find((other) => Math.abs(other.x - (2 * middle.x - corner.x)) < NEAR)
      const twinZ = corners.find((other) => Math.abs(other.z - (2 * middle.z - corner.z)) < NEAR)
      expect(twinX && twinZ).toBeDefined()
    }
  })

  it('centres one large feature on the north and south sides', () => {
    for (const side of ['north', 'south'] as const) {
      const features = belt.filter((piece) => sideOf(piece) === side && piece.role === 'feature')
      expect(features).toHaveLength(1)
      expect(features[0].x).toBeCloseTo((claim.west + claim.east) / 2)
    }
  })

  it('overlaps nothing: no other piece, the plate, the street, a road or a promenade', () => {
    const zones = everyZone(floor.zones)
    const street = { ...plan.claim, z: 0, depth: 12 }
    pieces.forEach((piece, index) => {
      for (const other of pieces.slice(index + 1))
        expect(overlapping(piece, other), `${piece.id} on ${other.id}`).toBe(false)
      expect(overlapping(piece, street), piece.id).toBe(false)
      for (const solid of [...zones, ...floor.rooms]) expect(overlapping(piece, solid)).toBe(false)
      for (const walk of plan.promenades) expect(overlapping(piece, walk), piece.id).toBe(false)
    })
    for (const piece of belt) {
      expect(overlapping(piece, floor), piece.id).toBe(false)
      for (const road of plan.roads) expect(overlapping(piece, roadStrip(road))).toBe(false)
    }
  })

  it('stays inside the boulevard', () => {
    for (const piece of belt) {
      const at = edges(piece)
      expect(at.west).toBeGreaterThanOrEqual(claim.west + BOULEVARD_M)
      expect(at.east).toBeLessThanOrEqual(claim.east - BOULEVARD_M)
      expect(at.north).toBeGreaterThanOrEqual(claim.north + BOULEVARD_M)
      expect(at.south).toBeLessThanOrEqual(claim.south - BOULEVARD_M)
    }
  })

  it('leaves the bare plate as lawn', () => {
    expect(belt.some((piece) => overlapping(piece, floor))).toBe(false)
  })

  it('is the same garden for the same floor', () => {
    expect(campusGreen(structuredClone(floor), plan)).toEqual(pieces)
  })

  it('keeps every row and the plaza when a desk column arrives under the same claim', () => {
    const grown = widened(floor, 5)
    const grownPlan = townBlocks(campusClaim(neededClaim(grown), plan.claim), 'full')
    expect(grownPlan.claim).toEqual(plan.claim)
    const after = campusGreen(grown, grownPlan)
    const deep = (piece: GreenPlot): boolean => piece.role === 'feature' || piece.role === 'corner'
    expect(after.filter((piece) => !deep(piece))).toEqual(pieces.filter((p) => !deep(p)))
    // A feature or corner the plate now reaches goes, with its twin; none moves.
    for (const piece of after.filter(deep)) expect(pieces).toContainEqual(piece)
  })
})
