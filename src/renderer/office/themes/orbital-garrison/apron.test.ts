import { describe, expect, it } from 'vitest'
import type { FloorGeometry } from '../../scene-model'
import { WORLD_APRON } from '../surroundings'
import { apronLots, apronReserved, apronStrips, HANGAR_OFFSET_M } from './apron'
import { buildLot } from './lots'
import { boundsOf, FLOORS, gapBetween, officeGap } from './yard.test-utils'

// The engine's rule: a thing of height h hides 1.43 h of ground behind it.
const HEIGHT_PER_METRE = 0.7
const LONGEST_BARE_STRETCH_M = 14
const sized = (floor: FloorGeometry) => `${floor.width} x ${floor.depth}`
const plateOf = (floor: FloorGeometry) => ({ x: 0, z: 0, width: floor.width, depth: floor.depth })

function overlaps(a: ReturnType<typeof plateOf>, b: ReturnType<typeof plateOf>): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 1e-9 &&
    Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - 1e-9
  )
}

// The longest run along one side of the plate with nothing standing beside it.
function longestGap(spans: readonly [number, number][], from: number, to: number): number {
  let reached = from
  let longest = 0
  for (const [start, end] of [...spans].sort((a, b) => a[0] - b[0])) {
    longest = Math.max(longest, start - reached)
    reached = Math.max(reached, end)
  }
  return Math.max(longest, to - reached)
}

describe.each(FLOORS.map((floor) => [sized(floor), floor] as const))(
  'the garrison apron around a %s m floor',
  (_size, floor) => {
    const lots = apronLots(floor)
    const reserved = apronReserved(floor)
    const west = -floor.width / 2 - WORLD_APRON.west
    const east = floor.width / 2 + WORLD_APRON.east
    const north = -floor.depth / 2 - WORLD_APRON.north
    const south = floor.depth / 2 + WORLD_APRON.south

    it('stays on the apron, off the plate and off the district, the hangar and the tower', () => {
      for (const lot of lots) {
        expect(lot.x - lot.width / 2).toBeGreaterThanOrEqual(west)
        expect(lot.x + lot.width / 2).toBeLessThanOrEqual(east)
        expect(lot.z - lot.depth / 2).toBeGreaterThanOrEqual(north)
        expect(lot.z + lot.depth / 2).toBeLessThanOrEqual(south)
        expect(overlaps(lot, plateOf(floor)), `${lot.id} on the plate`).toBe(false)
        for (const kept of reserved) expect(overlaps(lot, kept), lot.id).toBe(false)
        for (const other of lots) if (other !== lot) expect(overlaps(lot, other)).toBe(false)
      }
      for (const kept of reserved) expect(overlaps(kept, plateOf(floor))).toBe(false)
      expect(HANGAR_OFFSET_M).toBeGreaterThan(2.5 + 0.5)
    })

    it('leaves no long bare stretch on any side of the plate', () => {
      const things = [...lots, ...reserved]
      const along = (axis: 'x' | 'z', isBeside: (thing: (typeof things)[number]) => boolean) =>
        things.filter(isBeside).map((thing): [number, number] => {
          const half = (axis === 'x' ? thing.width : thing.depth) / 2
          return [thing[axis] - half, thing[axis] + half]
        })
      const halfWidth = floor.width / 2
      const halfDepth = floor.depth / 2
      const sides = [
        longestGap(
          along('x', (thing) => thing.z < -halfDepth),
          -halfWidth,
          halfWidth
        ),
        longestGap(
          along('x', (thing) => thing.z > halfDepth),
          -halfWidth,
          halfWidth
        ),
        longestGap(
          along('z', (thing) => thing.x < -halfWidth),
          -halfDepth,
          halfDepth
        ),
        longestGap(
          along('z', (thing) => thing.x > halfWidth),
          -halfDepth,
          halfDepth
        )
      ]
      for (const gap of sides) expect(gap).toBeLessThanOrEqual(LONGEST_BARE_STRETCH_M)
    })

    it('keeps everything low enough that no desk is hidden at any map rotation', () => {
      for (const lot of lots)
        for (const part of buildLot(lot, -0.5).parts) {
          const bounds = boundsOf(part)
          expect(bounds.top).toBeLessThanOrEqual(officeGap(floor, bounds) * HEIGHT_PER_METRE)
        }
    })

    it('lays a lit runway north of the plate and a hazard line round it', () => {
      const strips = apronStrips(floor)
      expect(strips.filter((part) => part.glow).length).toBeGreaterThan(8)
      for (const part of strips) {
        const bounds = boundsOf(part)
        expect(gapBetween(bounds, plateOf(floor))).toBeGreaterThan(0.5)
        expect(bounds.top).toBeLessThanOrEqual(officeGap(floor, bounds) * HEIGHT_PER_METRE)
        expect(bounds.x - bounds.width / 2).toBeGreaterThanOrEqual(west)
        expect(bounds.x + bounds.width / 2).toBeLessThanOrEqual(east)
        expect(bounds.z - bounds.depth / 2).toBeGreaterThanOrEqual(north)
        expect(bounds.z + bounds.depth / 2).toBeLessThanOrEqual(south)
      }
    })
  }
)
