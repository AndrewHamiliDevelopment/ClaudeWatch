import { expect, it } from 'vitest'
import { makeFloor, makeZone } from '../__tests__/fixtures'
import type { ZoneGeometry } from '../scene-model'
import { contains } from './lot-math'
import { thinnedLots } from './lot-thinning'
import { apronOf, surroundingLots, type Lot } from './surroundings'

// A company with one project office inside it: props line its walls, lots fill the yard.
function company(id: string, x: number): ZoneGeometry {
  const office = makeZone({ id: `${id}/p`, kind: 'project', x, z: -3, width: 18, depth: 26 })
  return makeZone({ id, kind: 'company', x, z: -3, width: 22, depth: 30, children: [office] })
}

const floor = makeFloor({
  floorId: 'f1',
  width: 96,
  depth: 44,
  zones: [company('c1', -34), company('c2', 34)],
  corridor: { z: 21, width: 2 },
  elevator: { x: -46.5, z: 21 }
})
const lots = surroundingLots(floor)
const isRing = (lot: Lot): boolean => lot.kind === 'building' && !contains(floor, lot)
const ringOf = (drawn: readonly Lot[]): Lot[] => drawn.filter(isRing)

it('draws every lot at a full share', () => {
  expect(thinnedLots(lots, 1, floor)).toEqual(lots)
})

it('draws the asked share of the buildings beyond the plate', () => {
  const ring = ringOf(lots)
  expect(ring.length).toBeGreaterThan(20)
  expect(ringOf(thinnedLots(lots, 0.6, floor))).toHaveLength(Math.round(ring.length * 0.6))
  expect(ringOf(thinnedLots(lots, 0.3, floor))).toHaveLength(Math.round(ring.length * 0.3))
  expect(ringOf(thinnedLots(lots, 0, floor))).toHaveLength(0)
})

it('keeps every prop and every building on the plate, whatever the share', () => {
  const onPlate = lots.filter((lot) => !isRing(lot))
  expect(onPlate.length).toBeGreaterThan(0)
  expect(thinnedLots(lots, 0, floor)).toEqual(onPlate)
})

it('thins every side of the ring instead of emptying one', () => {
  const apron = apronOf(floor)
  const ring = ringOf(thinnedLots(lots, 0.3, floor))
  const sides = {
    west: ring.filter((lot) => lot.x < apron.x - apron.width / 2),
    east: ring.filter((lot) => lot.x > apron.x + apron.width / 2),
    north: ring.filter((lot) => lot.z < apron.z - apron.depth / 2),
    south: ring.filter((lot) => lot.z > apron.z + apron.depth / 2)
  }
  for (const [side, kept] of Object.entries(sides)) expect(kept.length, side).toBeGreaterThan(0)
})

it('keeps at a lower share only lots it also keeps at a higher one', () => {
  const balanced = new Set(thinnedLots(lots, 0.6, floor).map((lot) => lot.id))
  for (const lot of thinnedLots(lots, 0.3, floor)) expect(balanced.has(lot.id), lot.id).toBe(true)
})

it('keeps the order of the lots, so a theme draws the same design on each', () => {
  const thinned = thinnedLots(lots, 0.6, floor)
  expect(thinned).toEqual(lots.filter((lot) => thinned.includes(lot)))
})
