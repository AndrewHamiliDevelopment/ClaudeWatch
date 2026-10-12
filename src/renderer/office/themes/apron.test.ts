import { describe, expect, it } from 'vitest'
import type { FloorGeometry } from '../scene-model'
import { apronLots, apronStands } from './apron'
import { LIVE_FLOORS, OFF_CENTRE_FLOOR } from './floors.test-utils'
import { DISTRICT_SIDES, HANGAR_SIDES, terraceLots } from './LotFill'
import { contains, overlaps, type Rect } from './lot-math'
import { apronStrips, colonyStand, padLots } from './orbital-garrison/apron'
import {
  apronOf,
  gapBetween,
  GROUND_Y,
  HEIGHT_PER_METRE,
  lotBase,
  officesOf,
  WORLD_APRON,
  type Lot
} from './surroundings'
import { TOWN_APRON } from './town-apron'

// The widest stretch along one side of the plate with nothing on the apron beside it.
function widestHole(things: readonly Rect[], from: number, to: number, axis: 'x' | 'z'): number {
  const size = axis === 'x' ? 'width' : 'depth'
  const spans = things
    .map((thing) => [thing[axis] - thing[size] / 2, thing[axis] + thing[size] / 2])
    .sort((a, b) => a[0] - b[0])
  let reached = from
  let widest = 0
  for (const [start, end] of spans) {
    widest = Math.max(widest, start - reached)
    reached = Math.max(reached, end)
  }
  return Math.max(widest, to - reached)
}

// Each theme family's rows, laid by the one placer.
const FAMILIES: readonly (readonly [string, (floor: FloorGeometry) => Lot[], number])[] = [
  ['Neo Edo and Brass town blocks', (floor) => apronLots(floor, TOWN_APRON), 5.5],
  [
    'Violet Court and Quiet Grove terraces',
    (floor) => terraceLots(floor, [...DISTRICT_SIDES, ...HANGAR_SIDES]),
    8
  ],
  ['Orbital Garrison pads', padLots, 14]
]
const FLOORS = [...LIVE_FLOORS, ['a plate centred at (20, -12)', OFF_CENTRE_FLOOR] as const]

describe.each(FAMILIES)('%s', (_family, lotsOn, longestBareStretch) => {
  describe.each(FLOORS)('around %s', (_name, floor) => {
    const lots = lotsOn(floor)
    const stands = [...apronStands(floor), colonyStand(floor)]
    const west = floor.x - floor.width / 2
    const east = floor.x + floor.width / 2
    const north = floor.z - floor.depth / 2
    const south = floor.z + floor.depth / 2

    it('are the same on every start', () => {
      expect(lotsOn(floor)).toEqual(lots)
    })

    it('stay on the apron, off the slab, off the landmarks and off each other', () => {
      const slab = { ...floor, width: floor.width + 1, depth: floor.depth + 1 }
      expect(lots.length).toBeGreaterThan(4)
      for (const lot of lots) {
        expect(contains(apronOf(floor), lot), `${lot.id} leaves the apron`).toBe(true)
        expect(overlaps(lot, slab), `${lot.id} on the slab`).toBe(false)
        for (const stand of apronStands(floor)) expect(overlaps(lot, stand), lot.id).toBe(false)
        for (const other of lots) if (other !== lot) expect(overlaps(lot, other)).toBe(false)
      }
    })

    it('limits every lot by its real distance to the nearest office', () => {
      const offices = officesOf(floor)
      for (const lot of lots) {
        const nearest = Math.min(...offices.map((office) => gapBetween(lot, office)))
        expect(lot.maxHeight).toBeLessThanOrEqual(HEIGHT_PER_METRE * nearest + 1e-9)
        expect(lot.maxHeight).toBeGreaterThanOrEqual(lot.kind === 'prop' ? 0.4 : 2)
      }
    })

    it('leave no long bare stretch on any side of the plate', () => {
      const beside = (isBeside: (thing: Rect) => boolean): Rect[] =>
        [...lots, ...stands].filter(isBeside)
      const holes = [
        widestHole(
          beside((thing) => thing.z < north),
          west,
          east,
          'x'
        ),
        widestHole(
          beside((thing) => thing.x < west),
          north,
          south,
          'z'
        ),
        widestHole(
          beside((thing) => thing.x > east),
          north,
          south,
          'z'
        )
      ]
      for (const hole of holes) expect(hole).toBeLessThanOrEqual(longestBareStretch)
      // The gate's avenue is the one opening, on the south side.
      expect(
        widestHole(
          beside((thing) => thing.z > south),
          west,
          east,
          'x'
        )
      ).toBeLessThanOrEqual(longestBareStretch + 3.5)
    })
  })
})

it('stands a lot on the slab only where the real plate lies', () => {
  const floor = OFF_CENTRE_FLOOR
  const lot = { width: 2, depth: 2 }
  expect(lotBase({ ...lot, x: floor.x, z: floor.z }, floor)).toBe(0)
  expect(lotBase({ ...lot, x: floor.x, z: floor.z + floor.depth }, floor)).toBe(GROUND_Y)
  expect(lotBase({ ...lot, x: floor.x - floor.width, z: floor.z }, floor)).toBe(GROUND_Y)
})

describe.each(FLOORS)('the garrison strips around %s', (_name, floor) => {
  it('lay a lit runway north of the plate and a hazard line round it', () => {
    const strips = apronStrips(floor)
    expect(strips.filter((part) => part.glow).length).toBeGreaterThan(2)
    for (const part of strips) {
      const strip = { x: part.x, z: part.z, width: part.scaleX, depth: part.scaleZ }
      expect(gapBetween(strip, floor)).toBeGreaterThan(0.5)
      expect(contains(apronOf(floor), strip)).toBe(true)
      expect(strip.z).toBeLessThan(floor.z + floor.depth / 2 + WORLD_APRON.south)
    }
  })
})
