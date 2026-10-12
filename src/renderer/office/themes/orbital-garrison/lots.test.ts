import { describe, expect, it, vi } from 'vitest'
import { GROUND_Y, lotBase, surroundingLots, type Lot } from '../surroundings'
import { BUILDINGS } from './buildings'
import { buildLot } from './lots'
import { GARRISON } from './palette'
import { PROPS } from './yard-props'
import { boundsOf, FLOORS } from './yard.test-utils'

const PALETTE = new Set<string>(Object.values(GARRISON))
const EPSILON = 1e-6
const TOWERS = ['comms-tower', 'control-tower']

const lot = (overrides: Partial<Lot>): Lot => ({
  id: 'test',
  kind: 'building',
  x: 40,
  z: -30,
  width: 6,
  depth: 7,
  maxHeight: 24,
  seed: 1,
  zoneId: null,
  ...overrides
})

describe('what Orbital Garrison stands on a lot', () => {
  it('offers at least four buildings and six props, no two alike', () => {
    expect(BUILDINGS.length).toBeGreaterThanOrEqual(4)
    expect(PROPS.length).toBeGreaterThanOrEqual(6)
    for (const designs of [BUILDINGS, PROPS]) {
      const shapes = designs.map((design) => JSON.stringify(design.build(12, 0.5)))
      expect(new Set(shapes).size).toBe(designs.length)
      expect(new Set(designs.map((design) => design.id)).size).toBe(designs.length)
    }
  })

  it.each(FLOORS.map((floor) => [`${floor.width} x ${floor.depth}`, floor] as const))(
    'fills every lot of a %s m floor, inside its footprint and under its height',
    (_size, floor) => {
      const lots = surroundingLots(floor)
      expect(lots.length).toBeGreaterThan(20)
      for (const each of lots) {
        const base = lotBase(each, floor)
        const { parts } = buildLot(each, base)
        expect(parts.length, each.id).toBeGreaterThan(3)
        for (const part of parts) {
          const bounds = boundsOf(part)
          expect(bounds.isQuarterTurned).toBe(true)
          expect(PALETTE.has(part.color), `${part.color} is not a Garrison colour`).toBe(true)
          expect(bounds.top, `${each.id} height`).toBeLessThanOrEqual(each.maxHeight + EPSILON)
          expect(bounds.bottom).toBeGreaterThanOrEqual(base - EPSILON)
          expect(Math.abs(bounds.x - each.x) + bounds.width / 2).toBeLessThanOrEqual(
            each.width / 2 + EPSILON
          )
          expect(Math.abs(bounds.z - each.z) + bounds.depth / 2).toBeLessThanOrEqual(
            each.depth / 2 + EPSILON
          )
        }
      }
    }
  )

  it('stands lots on the slab inside the plate and on the ground outside it', () => {
    const floor = FLOORS[0]
    expect(lotBase(lot({ x: floor.x, z: floor.z }), floor)).toBe(0)
    expect(lotBase(lot({ x: floor.x + floor.width, z: floor.z }), floor)).toBe(GROUND_Y)
  })

  it('mixes at least five buildings and six props around one floor', () => {
    const lots = surroundingLots(FLOORS[1])
    const drawn = (kind: Lot['kind']) =>
      new Set(lots.filter((each) => each.kind === kind).map((each) => buildLot(each, 0).designId))
    expect(drawn('building').size).toBeGreaterThanOrEqual(5)
    expect(drawn('prop').size).toBeGreaterThanOrEqual(6)
  })

  it('never puts two of the same building side by side all the way round', () => {
    const buildings = surroundingLots(FLOORS[1]).filter((each) => each.kind === 'building')
    const ids = buildings.map((each) => buildLot(each, 0).designId)
    const repeats = ids.filter((id, index) => index > 0 && ids[index - 1] === id).length
    expect(repeats / ids.length).toBeLessThan(0.4)
  })

  it('keeps towers for the far ring and the lots that allow them', () => {
    const seeds = Array.from({ length: 80 }, (_, index) => index * 7919 + 13)
    const pick = (overrides: Partial<Lot>) =>
      seeds.map((seed) => buildLot(lot({ seed, ...overrides }), GROUND_Y).designId)
    for (const id of pick({ maxHeight: 3, zoneId: 'company:a' })) expect(TOWERS).not.toContain(id)
    expect(pick({ maxHeight: 24, zoneId: null }).some((id) => TOWERS.includes(id))).toBe(true)
  })

  it('draws the same world on every start', () => {
    const random = vi.spyOn(Math, 'random')
    const lots = surroundingLots(FLOORS[1])
    const once = lots.map((each) => buildLot(each, 0))
    expect(lots.map((each) => buildLot(each, 0))).toEqual(once)
    expect(random).not.toHaveBeenCalled()
    random.mockRestore()
  })
})
