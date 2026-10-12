import { describe, expect, it } from 'vitest'
import { APRON_TOP_Y, apronLots, apronReserved } from './apron'
import { WORLD_APRON, type Lot } from './surroundings'

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>

const overlaps = (a: Rect, b: Rect): boolean =>
  Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2

function gapToPlate(lot: Rect, floor: { width: number; depth: number }): number {
  const dx = Math.max(0, Math.abs(lot.x) - lot.width / 2 - floor.width / 2)
  const dz = Math.max(0, Math.abs(lot.z) - lot.depth / 2 - floor.depth / 2)
  return Math.hypot(dx, dz)
}

// The widest stretch along one side of the plate with nothing on the apron beside it.
function widestHole(lots: readonly Rect[], from: number, to: number, axis: 'x' | 'z'): number {
  const size = axis === 'x' ? 'width' : 'depth'
  const spans = lots
    .map((lot) => [lot[axis] - lot[size] / 2, lot[axis] + lot[size] / 2])
    .sort((a, b) => a[0] - b[0])
  let reached = from
  let widest = 0
  for (const [start, end] of spans) {
    widest = Math.max(widest, start - reached)
    reached = Math.max(reached, end)
  }
  return Math.max(widest, to - reached)
}

describe.each([
  ['a compact floor', { width: 60, depth: 50 }],
  ['a busy floor', { width: 110, depth: 85 }],
  ['a one-office floor', { width: 18, depth: 13 }]
])('apron lots around %s', (_name, floor) => {
  const lots = apronLots(floor)

  it('are the same on every start', () => {
    expect(apronLots(floor)).toEqual(lots)
  })

  it('stay on the apron, off the plate, off the landmarks and off each other', () => {
    const slab = { x: 0, z: 0, width: floor.width + 2, depth: floor.depth + 2 }
    for (const lot of lots) {
      expect(overlaps(lot, slab)).toBe(false)
      expect(lot.x - lot.width / 2).toBeGreaterThanOrEqual(-floor.width / 2 - WORLD_APRON.west)
      expect(lot.x + lot.width / 2).toBeLessThanOrEqual(floor.width / 2 + WORLD_APRON.east)
      expect(lot.z - lot.depth / 2).toBeGreaterThanOrEqual(-floor.depth / 2 - WORLD_APRON.north)
      expect(lot.z + lot.depth / 2).toBeLessThanOrEqual(floor.depth / 2 + WORLD_APRON.south)
      for (const landmark of apronReserved(floor)) expect(overlaps(lot, landmark)).toBe(false)
      for (const other of lots) if (other !== lot) expect(overlaps(lot, other)).toBe(false)
    }
  })

  it('never rise high enough to hide a desk at any map rotation', () => {
    for (const lot of lots) {
      expect(lot.maxHeight).toBeLessThanOrEqual(0.7 * gapToPlate(lot, floor) + 1e-9)
      expect(lot.maxHeight - APRON_TOP_Y).toBeGreaterThanOrEqual(lot.kind === 'prop' ? 0.9 : 2)
    }
  })

  it('leave no empty band on any side of the plate', () => {
    const { width, depth } = floor
    const north = lots.filter((lot) => lot.z < -depth / 2)
    const south = lots.filter((lot) => lot.z > depth / 2)
    const west = lots.filter((lot) => lot.x < -width / 2)
    // The hangar fills its own stretch of the east side.
    const east = [...lots.filter((lot) => lot.x > width / 2), apronReserved(floor)[0]]
    expect(widestHole(north, -width / 2, width / 2, 'x')).toBeLessThanOrEqual(5.5)
    expect(widestHole(west, -depth / 2, depth / 2, 'z')).toBeLessThanOrEqual(5.5)
    expect(widestHole(east, -depth / 2, depth / 2, 'z')).toBeLessThanOrEqual(5.5)
    // The gate's avenue is the one opening, on the south side.
    expect(widestHole(south, -width / 2, width / 2, 'x')).toBeLessThanOrEqual(9)
    expect(lots.some((lot) => lot.kind === 'building')).toBe(true)
    expect(lots.some((lot) => lot.kind === 'prop')).toBe(true)
  })
})
