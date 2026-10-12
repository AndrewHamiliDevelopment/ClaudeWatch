import { describe, expect, it } from 'vitest'
import { buildFixtureFrame } from '../fixture/fixture-feed'
import { streetRects } from '../logic/streets'
import { DESK_REACH, doorSide, roomWallSegments, SIDE_NORMAL } from '../logic/room-layout'
import { APRON_TOP_Y } from '../themes/town-apron'
import { DEFAULT_THEME_ID } from '../themes/registry'
import { GROUND_Y, surroundingLots } from '../themes/surroundings'
import type { ZoneGeometry } from '../scene-model'
import { districtLots } from './district-lots'
import { doorstep, groundHeight, nearestOpen, walkGround, walkPath } from './walk-ground'

const [floor] = buildFixtureFrame(0, 0).floors
const lots = surroundingLots(floor)
const ground = walkGround(floor, lots)

function flatten(zones: readonly ZoneGeometry[]): ZoneGeometry[] {
  return zones.flatMap((zone) => [zone, ...flatten(zone.children)])
}
const walled = flatten(floor.zones).flatMap((zone) =>
  zone.door ? [{ ...zone, door: zone.door }] : []
)

const SAMPLE_M = 0.1

// Every point a walker passes on the way, a tenth of a metre apart.
function pointsAlong(path: readonly { x: number; z: number }[]) {
  return path.slice(1).flatMap((to, index) => {
    const from = path[index]
    const steps = Math.max(1, Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / SAMPLE_M))
    return Array.from({ length: steps + 1 }, (_, step) => ({
      x: from.x + ((to.x - from.x) * step) / steps,
      z: from.z + ((to.z - from.z) * step) / steps
    }))
  })
}

describe('walkGround', () => {
  it('blocks every lot', () => {
    expect(lots.length).toBeGreaterThan(20)
    for (const lot of lots) expect(ground.isOpen(lot)).toBe(false)
  })

  it('blocks the walls of every company, project and office', () => {
    expect(walled.length).toBeGreaterThan(10)
    for (const zone of walled)
      for (const segment of roomWallSegments(zone))
        expect(ground.isOpen(segment), `${zone.id} wall at ${segment.x},${segment.z}`).toBe(false)
  })

  it('opens every door', () => {
    for (const zone of walled) expect(ground.isOpen(zone.door), zone.id).toBe(true)
  })

  it('blocks every desk and the seat behind it', () => {
    for (const room of floor.rooms)
      for (const seat of room.seats) {
        expect(ground.isOpen(seat)).toBe(false)
        const desk = {
          x: seat.x + Math.sin(seat.heading) * DESK_REACH,
          z: seat.z + Math.cos(seat.heading) * DESK_REACH
        }
        expect(ground.isOpen(desk)).toBe(false)
      }
  })

  it('leaves the gate, the lounges and the streets open', () => {
    expect(ground.isOpen(floor.elevator)).toBe(true)
    for (const company of floor.zones)
      if (company.lounge) expect(ground.isOpen(company.lounge)).toBe(true)
    const streets = streetRects(floor, lots)
    expect(streets.filter((street) => !ground.isOpen(street))).toEqual([])
  })

  it('is closed outside the scene', () => {
    expect(ground.isOpen({ x: 10_000, z: 0 })).toBe(false)
  })
})

describe('nearestOpen', () => {
  it('moves a target inside a building to the nearest open ground', () => {
    const building = lots.find((lot) => lot.kind === 'building')
    if (!building) throw new Error('the seeded town has no building')
    const spot = nearestOpen(ground, building)
    if (!spot) throw new Error('no open ground near the building')
    expect(ground.isOpen(spot)).toBe(true)
    const reach = Math.hypot(building.width, building.depth) / 2 + 1
    expect(Math.hypot(spot.x - building.x, spot.z - building.z)).toBeLessThan(reach)
  })

  it('keeps a target that is already open', () => {
    expect(nearestOpen(ground, { x: 0, z: 0 })).toEqual({ x: 0, z: 0 })
  })
})

describe('walkPath', () => {
  const farCompany = [...floor.zones].sort((a, b) => Math.hypot(b.x, b.z) - Math.hypot(a.x, a.z))[0]
  const farRoom = [...floor.rooms].sort(
    (a, b) =>
      Math.hypot(a.x - farCompany.x, a.z - farCompany.z) -
      Math.hypot(b.x - farCompany.x, b.z - farCompany.z)
  )[0]

  it('walks from the gate to a desk in the far company without crossing a blocked cell', () => {
    const [seat] = farRoom.seats
    const path = walkPath(ground, floor.elevator, seat)
    expect(path.length).toBeGreaterThan(1)
    expect(path[0]).toEqual(floor.elevator)
    for (const point of pointsAlong(path)) expect(ground.isOpen(point)).toBe(true)
    const end = path[path.length - 1]
    expect(Math.hypot(end.x - seat.x, end.z - seat.z)).toBeLessThan(1.5)
  })

  it('goes in through the door', () => {
    const path = walkPath(ground, floor.elevator, { x: farRoom.x, z: farRoom.z - 1 })
    const passesDoor = pointsAlong(path).some(
      (point) => Math.hypot(point.x - farRoom.door.x, point.z - farRoom.door.z) < 0.5
    )
    expect(passesDoor).toBe(true)
  })

  it('reaches a street out in the ring', () => {
    const building = lots.find((lot) => lot.kind === 'building' && lot.zoneId === null)
    if (!building) throw new Error('the seeded town has no far ring')
    const path = walkPath(ground, floor.elevator, building)
    expect(path.length).toBeGreaterThan(1)
    for (const point of pointsAlong(path)) expect(ground.isOpen(point)).toBe(true)
  })

  it('still reaches the ring with the district standing on the apron', () => {
    const town = [...lots, ...districtLots(DEFAULT_THEME_ID, floor)]
    const withDistrict = walkGround(floor, town)
    const building = lots.find((lot) => lot.kind === 'building' && lot.zoneId === null)
    if (!building) throw new Error('the seeded town has no far ring')
    const path = walkPath(withDistrict, floor.elevator, building)
    expect(path.length).toBeGreaterThan(1)
    for (const point of pointsAlong(path)) expect(withDistrict.isOpen(point)).toBe(true)
  })

  it('takes far fewer turns than the grid it searched', () => {
    const path = walkPath(ground, floor.elevator, farRoom.seats[0])
    expect(path.length).toBeLessThan(40)
  })
})

describe('doorstep', () => {
  it('stands just outside the door, on open ground', () => {
    for (const zone of walled) {
      const spot = doorstep(zone)
      const outward = SIDE_NORMAL[doorSide(zone)]
      expect(spot.x - zone.door.x).toBeCloseTo(outward.x * 1)
      expect(spot.z - zone.door.z).toBeCloseTo(outward.z * 1)
      expect(ground.isOpen(spot), zone.id).toBe(true)
    }
  })
})

describe('groundHeight', () => {
  it('is the slab on the plate, the paving on the apron and the ground beyond', () => {
    expect(groundHeight(floor, floor.elevator)).toBe(0)
    const west = (floor.x ?? 0) - floor.width / 2
    expect(groundHeight(floor, { x: west - 3, z: 0 })).toBe(APRON_TOP_Y)
    expect(groundHeight(floor, { x: west - 40, z: 0 })).toBe(GROUND_Y)
  })
})
