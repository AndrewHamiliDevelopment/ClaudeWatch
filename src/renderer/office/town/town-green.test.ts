import { describe, expect, it } from 'vitest'
import type { ZoneGeometry } from '../scene-model'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import type { GreenPlot } from './garden-pieces'
import { campusClaim, neededClaim } from './town-claim'
import { campusGreen } from './town-green'
import { townBlocks } from './town-plan'
import { MAP_ROTATIONS, isHidden } from './sightline.test-utils'
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
const hedgeLength = (hedge: GreenPlot): number =>
  isAlongX(sideOf(hedge)) ? hedge.width : hedge.depth

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

  // One instanced batch: a piece costs nothing, a new shape a draw, so a wide campus keeps its rows.
  it('plants a tree every 6 m along every run, however wide the campus', () => {
    for (const side of SIDES)
      for (const run of runsOf(side)) {
        const trees = run.pieces
          .filter((piece) => piece.role === 'tree')
          .map(along)
          .sort((a, b) => a - b)
        for (let index = 1; index < trees.length; index++)
          expect(trees[index] - trees[index - 1], `${side} tree pitch`).toBeCloseTo(6, 2)
      }
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
      for (const role of ['tree', 'lamp', 'seat', 'innerTree']) {
        const row = rows.filter((piece) => sideOf(piece) === side && piece.role === role)
        if (row.length === 0) continue
        expect(new Set(row.map((p) => `${p.width}x${p.depth}x${p.maxHeight}`)).size).toBe(1)
      }
  })

  // How far a piece stands in from its side's claim edge.
  const depthOf = (piece: GreenPlot): number =>
    ({
      north: piece.z - claim.north,
      south: claim.south - piece.z,
      west: piece.x - claim.west,
      east: claim.east - piece.x
    })[sideOf(piece)]

  it('plants an inner avenue of full-size trees behind the walk row, offset half a pitch', () => {
    for (const side of SIDES) {
      const inner = belt.filter((piece) => sideOf(piece) === side && piece.role === 'innerTree')
      if (isAlongX(side)) expect(inner.length, side).toBeGreaterThanOrEqual(4)
      const outer = belt.filter((piece) => sideOf(piece) === side && piece.role === 'tree')
      for (const tree of inner) {
        expect(depthOf(tree)).toBeGreaterThan(depthOf(outer[0]) + 1)
        expect(tree.maxHeight).toBeGreaterThanOrEqual(2 * outer[0].maxHeight)
        expect(
          outer.some((each) => Math.abs(Math.abs(along(each) - along(tree)) - 3) < NEAR),
          `${tree.id} sits half a pitch from the walk row`
        ).toBe(true)
      }
      expect(new Set(inner.map(depthOf)).size).toBeLessThan(2)
    }
  })

  it('pitches the inner avenue at 6 m, with gaps only where a feature or corner stands', () => {
    for (const side of SIDES)
      for (const run of runsOf(side)) {
        const trees = run.pieces
          .filter((piece) => piece.role === 'innerTree')
          .map(along)
          .sort((a, b) => a - b)
        for (let index = 1; index < trees.length; index++) {
          const steps = (trees[index] - trees[index - 1]) / 6
          expect(steps).toBeCloseTo(Math.round(steps), 2)
        }
      }
  })

  it('edges both long sides of the lawn with continuous hedge segments', () => {
    for (const side of ['north', 'south'] as const) {
      const hedges = belt.filter((piece) => sideOf(piece) === side && piece.role === 'hedge')
      const lines = Map.groupBy(hedges, (hedge) => depthOf(hedge).toFixed(2))
      expect(lines.size, side).toBe(2)
      const [outerLine, innerLine] = [...lines.keys()].map(Number).sort((a, b) => a - b)
      const outer = belt.filter((piece) => sideOf(piece) === side && piece.role === 'tree')
      const inner = belt.filter((piece) => sideOf(piece) === side && piece.role === 'innerTree')
      expect(outerLine).toBeLessThan(depthOf(outer[0]))
      expect(innerLine).toBeGreaterThan(depthOf(inner[0]))
      // Separate segments only across a real gap: two that touch would be one.
      for (const segments of lines.values()) {
        const spans = segments
          .map((hedge) => [
            along(hedge) - hedgeLength(hedge) / 2,
            along(hedge) + hedgeLength(hedge) / 2
          ])
          .sort((a, b) => a[0] - b[0])
        for (let index = 1; index < spans.length; index++)
          expect(spans[index][0] - spans[index - 1][1]).toBeGreaterThan(1)
      }
    }
  })

  it('hides no part of the promenade round the campus at any map rotation', () => {
    const boxes = belt.map((piece) => ({ ...piece, height: piece.maxHeight }))
    const ring = plan.promenades.filter((walk) => overlapping(walk, plan.claim))
    let hidden = 0
    let samples = 0
    for (const walk of ring)
      for (let x = walk.x - walk.width / 2; x <= walk.x + walk.width / 2; x += 1)
        for (let z = walk.z - walk.depth / 2; z <= walk.z + walk.depth / 2; z += 1)
          for (const azimuth of MAP_ROTATIONS) {
            samples++
            if (isHidden({ x, z }, boxes, azimuth)) hidden++
          }
    expect(hidden / samples).toBeLessThanOrEqual(0.01)
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
    // Only what stands behind the walk row answers to the plate.
    const deep = (piece: GreenPlot): boolean =>
      ['feature', 'corner', 'innerTree'].includes(piece.role) || piece.id.includes(':hedge:inner:')
    expect(after.filter((piece) => !deep(piece))).toEqual(pieces.filter((p) => !deep(p)))
    for (const piece of after.filter((each) => each.role === 'feature' || each.role === 'corner'))
      expect(pieces).toContainEqual(piece)
  })
})
