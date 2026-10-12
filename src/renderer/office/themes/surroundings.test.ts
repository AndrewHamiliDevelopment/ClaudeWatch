import { afterEach, describe, expect, it, vi } from 'vitest'
import { makeFloor, makeRoom, makeZone } from '../__tests__/fixtures'
import type { FloorGeometry, ZoneGeometry } from '../scene-model'
import { LOT_CAP, WORLD_APRON, sceneExtent, surroundingLots, type Lot } from './surroundings'

interface Rect {
  x: number
  z: number
  width: number
  depth: number
}

// Written out again here on purpose: the rules are checked against their own arithmetic.
function gap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2)
  const dz = Math.max(0, Math.abs(a.z - b.z) - (a.depth + b.depth) / 2)
  return Math.hypot(dx, dz)
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 1e-9 &&
    Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - 1e-9
  )
}

const PROJECT_INSET_M = 2

// A company with its gate on the south wall and one project office inside it.
function company(id: string, rect: Rect): ZoneGeometry {
  const project: Rect = {
    x: rect.x,
    z: rect.z,
    width: rect.width - PROJECT_INSET_M * 2,
    depth: rect.depth - PROJECT_INSET_M * 2
  }
  return makeZone({
    id,
    kind: 'company',
    companyKey: id,
    ...rect,
    door: { x: rect.x, z: rect.z + rect.depth / 2 },
    children: [
      makeZone({
        id: `${id}/p`,
        kind: 'project',
        companyKey: id,
        projectKey: `${id}/p`,
        ...project,
        door: { x: project.x, z: project.z + project.depth / 2 }
      })
    ]
  })
}

function floorOf(size: { width: number; depth: number }, zones: ZoneGeometry[]): FloorGeometry {
  return makeFloor({
    floorId: 'f1',
    ...size,
    zones,
    corridor: { z: size.depth / 2 - 1, width: 2 },
    elevator: { x: -size.width / 2 + 1.5, z: size.depth / 2 - 1 }
  })
}

const plateOf = (floor: FloorGeometry): Rect => ({
  x: 0,
  z: 0,
  width: floor.width,
  depth: floor.depth
})

function apronOf(floor: FloorGeometry): Rect {
  const west = -floor.width / 2 - WORLD_APRON.west
  const east = floor.width / 2 + WORLD_APRON.east
  const north = -floor.depth / 2 - WORLD_APRON.north
  const south = floor.depth / 2 + WORLD_APRON.south
  return { x: (west + east) / 2, z: (north + south) / 2, width: east - west, depth: south - north }
}

const buildings = (lots: readonly Lot[]): Lot[] => lots.filter((lot) => lot.kind === 'building')
const props = (lots: readonly Lot[]): Lot[] => lots.filter((lot) => lot.kind === 'prop')
const ringOf = (floor: FloorGeometry): Lot[] =>
  buildings(surroundingLots(floor)).filter((lot) => !overlaps(lot, plateOf(floor)))

function ringSides(floor: FloorGeometry): Record<string, Lot[]> {
  const apron = apronOf(floor)
  const ring = ringOf(floor)
  return {
    west: ring.filter((lot) => lot.x < apron.x - apron.width / 2),
    east: ring.filter((lot) => lot.x > apron.x + apron.width / 2),
    north: ring.filter((lot) => lot.z < apron.z - apron.depth / 2),
    south: ring.filter((lot) => lot.z > apron.z + apron.depth / 2)
  }
}

const lone = floorOf({ width: 28, depth: 24 }, [
  company('c1', { x: 0, z: -1, width: 20, depth: 16 })
])

// Three companies, one of them across a wide yard, with the corridor and the lift in the south.
const busy = floorOf({ width: 96, depth: 44 }, [
  company('c1', { x: -34, z: -3, width: 22, depth: 30 }),
  company('c2', { x: -8.5, z: -3, width: 23, depth: 30 }),
  company('c3', { x: 34, z: -3, width: 22, depth: 30 })
])

afterEach(() => vi.restoreAllMocks())

describe('rule 1: where lots go', () => {
  it('rings the floor with building lots two or more rows deep on every side', () => {
    const apron = apronOf(lone)
    for (const [side, lots] of Object.entries(ringSides(lone))) {
      const distances = lots.map((lot) => gap(lot, apron))
      expect(distances.length, side).toBeGreaterThanOrEqual(4)
      // Two rows: one that starts near the apron and one a block or more further out.
      expect(Math.max(...distances) - Math.min(...distances), side).toBeGreaterThan(8)
    }
  })

  it('gives the inner rows to the company and the far ring to the floor', () => {
    const apron = apronOf(lone)
    const owned = ringOf(lone).filter((lot) => lot.zoneId === 'c1')
    const far = ringOf(lone).filter((lot) => lot.zoneId === null)
    expect(owned.length).toBeGreaterThan(0)
    expect(far.length).toBeGreaterThan(0)
    const farthestOwned = Math.max(...owned.map((lot) => gap(lot, apron)))
    const nearestFar = Math.min(...far.map((lot) => gap(lot, apron)))
    expect(nearestFar).toBeGreaterThan(farthestOwned)
  })

  it('varies building sizes by the seed', () => {
    const widths = new Set(ringOf(lone).map((lot) => lot.width.toFixed(2)))
    expect(widths.size).toBeGreaterThan(5)
  })

  it('fills a gap between companies only when it is wide enough', () => {
    const between = (lot: Lot, west: Rect, east: Rect): boolean =>
      lot.x > west.x + west.width / 2 && lot.x < east.x - east.width / 2 && Math.abs(lot.z) < 15
    const [c1, c2, c3] = busy.zones
    const lots = buildings(surroundingLots(busy))
    // c2 and c3 are 20 m apart: room for a building and a 3 m lane on both sides of it.
    expect(lots.filter((lot) => between(lot, c2, c3)).length).toBeGreaterThan(0)
    // c1 and c2 are 3 m apart: that is the lane, nothing else fits.
    expect(lots.filter((lot) => between(lot, c1, c2))).toEqual([])
  })

  it('sets small props just outside company walls, on the plate', () => {
    const lots = props(surroundingLots(busy))
    expect(lots.length).toBeGreaterThan(6)
    for (const lot of lots) {
      const owner = busy.zones.find((zone) => zone.id === lot.zoneId)
      if (!owner) throw new Error(`${lot.id} has no company`)
      expect(Math.max(lot.width, lot.depth), lot.id).toBeLessThanOrEqual(2)
      expect(Math.min(lot.width, lot.depth), lot.id).toBeGreaterThanOrEqual(0.8)
      expect(gap(lot, owner), lot.id).toBeLessThan(0.5)
      expect(gap(lot, owner), lot.id).toBeGreaterThan(0)
      expect(Math.abs(lot.x) + lot.width / 2, lot.id).toBeLessThanOrEqual(busy.width / 2)
      expect(Math.abs(lot.z) + lot.depth / 2, lot.id).toBeLessThanOrEqual(busy.depth / 2)
    }
  })

  it('still rings a floor that has no company on it yet', () => {
    const empty = makeFloor({ floorId: 'empty', rooms: [makeRoom({ id: 'r1' })] })
    const lots = surroundingLots(empty)
    expect(buildings(lots).length).toBeGreaterThan(8)
    expect(lots.every((lot) => lot.zoneId === null)).toBe(true)
  })
})

describe('rule 2: what a lot never overlaps', () => {
  const lots = surroundingLots(busy)
  const allZones = (zones: readonly ZoneGeometry[]): ZoneGeometry[] =>
    zones.flatMap((zone) => [zone, ...allZones(zone.children)])

  it('keeps clear of every company, project office and room', () => {
    const room = makeRoom({ id: 'r1', x: 20, z: 0, width: 6, depth: 5, door: { x: 20, z: 2.5 } })
    const withRoom = { ...busy, rooms: [room] }
    for (const lot of surroundingLots(withRoom)) {
      for (const zone of allZones(withRoom.zones)) expect(overlaps(lot, zone), lot.id).toBe(false)
      expect(overlaps(lot, room), lot.id).toBe(false)
    }
  })

  it('keeps a walkway: buildings 3 m from any company, props 1.5 m from the next one', () => {
    for (const lot of buildings(lots))
      for (const zone of busy.zones) expect(gap(lot, zone), lot.id).toBeGreaterThanOrEqual(3)
    for (const lot of props(lots))
      for (const zone of busy.zones)
        if (zone.id !== lot.zoneId) expect(gap(lot, zone), lot.id).toBeGreaterThanOrEqual(1.5)
    // Props on the two sides of one lane never face each other across less than the walkway.
    for (const [index, lot] of props(lots).entries())
      for (const other of props(lots).slice(index + 1))
        expect(gap(lot, other), `${lot.id} / ${other.id}`).toBeGreaterThanOrEqual(1.5)
  })

  it('keeps 2 m clear in front of every door', () => {
    // Every door in these floors is on a south wall, so "in front" is +z.
    const GATE_WIDTH_M = 3.2
    for (const zone of allZones(busy.zones)) {
      if (!zone.door) continue
      const ahead: Rect = { x: zone.door.x, z: zone.door.z + 1, width: GATE_WIDTH_M, depth: 2 }
      for (const lot of lots) expect(overlaps(lot, ahead), `${lot.id} at ${zone.id}`).toBe(false)
    }
  })

  it('keeps off the corridor lane and away from the lift', () => {
    const lane: Rect = { x: 0, z: busy.corridor.z, width: busy.width, depth: busy.corridor.width }
    const lift: Rect = { x: busy.elevator.x, z: busy.elevator.z, width: 2, depth: 2 }
    for (const lot of lots) {
      expect(overlaps(lot, lane), lot.id).toBe(false)
      expect(overlaps(lot, lift), lot.id).toBe(false)
    }
  })

  it('stands wholly on the plate or wholly beyond the apron the district stands on', () => {
    const apron = apronOf(busy)
    for (const lot of lots) {
      if (!overlaps(lot, apron)) continue
      expect(Math.abs(lot.x) + lot.width / 2, lot.id).toBeLessThanOrEqual(busy.width / 2)
      expect(Math.abs(lot.z) + lot.depth / 2, lot.id).toBeLessThanOrEqual(busy.depth / 2)
    }
  })

  it('never lets two lots overlap', () => {
    for (const [index, lot] of lots.entries())
      for (const other of lots.slice(index + 1))
        expect(overlaps(lot, other), `${lot.id} / ${other.id}`).toBe(false)
  })

  it('gives every lot its own id', () => {
    expect(new Set(lots.map((lot) => lot.id)).size).toBe(lots.length)
  })
})

describe('rule 3: nothing may hide a desk', () => {
  it('limits height to 0.7 of the distance to the nearest project office', () => {
    for (const floor of [lone, busy]) {
      const offices = floor.zones.flatMap((zone) => zone.children)
      for (const lot of surroundingLots(floor)) {
        const nearest = Math.min(...offices.map((office) => gap(lot, office)))
        expect(lot.maxHeight, lot.id).toBeGreaterThan(0)
        expect(lot.maxHeight, lot.id).toBeLessThanOrEqual(nearest * 0.7 + 1e-9)
      }
    }
  })

  it('measures from a room as well, for a floor whose rooms have no project around them', () => {
    const room = makeRoom({ id: 'r1', x: 0, z: 0, width: 6, depth: 5 })
    const floor = makeFloor({ floorId: 'rooms-only', rooms: [room] })
    for (const lot of surroundingLots(floor))
      expect(lot.maxHeight, lot.id).toBeLessThanOrEqual(gap(lot, room) * 0.7 + 1e-9)
  })
})

describe('rule 4: the same floor gives the same lots', () => {
  it('is repeatable and uses neither Math.random nor the clock', () => {
    const random = vi.spyOn(Math, 'random')
    const now = vi.spyOn(Date, 'now')
    expect(surroundingLots(busy)).toEqual(surroundingLots(structuredClone(busy)))
    expect(random).not.toHaveBeenCalled()
    expect(now).not.toHaveBeenCalled()
  })

  it('seeds a lot from its zone and its index, not from where the zone stands', () => {
    const moved = floorOf({ width: 28, depth: 24 }, [
      company('c1', { x: 2, z: 1, width: 20, depth: 16 })
    ])
    const seeds = new Map(surroundingLots(lone).map((lot) => [lot.id, lot.seed]))
    const shared = surroundingLots(moved).filter((lot) => seeds.has(lot.id))
    expect(shared.length).toBeGreaterThan(10)
    for (const lot of shared) expect(lot.seed, lot.id).toBe(seeds.get(lot.id))
  })

  it('keeps the id, position and seed of a lot that still fits when another company grows', () => {
    const grown = floorOf({ width: 116, depth: 44 }, [
      busy.zones[0],
      busy.zones[1],
      company('c3', { x: 39, z: -3, width: 32, depth: 30 })
    ])
    const before = surroundingLots(busy).filter((lot) => lot.id.startsWith('c1:'))
    const after = new Map(surroundingLots(grown).map((lot) => [lot.id, lot]))
    const kept = before.filter((lot) => after.has(lot.id))
    expect(kept.length).toBeGreaterThan(before.length / 2)
    for (const lot of kept) {
      const { id, x, z, width, depth, seed } = lot
      expect(after.get(id), id).toMatchObject({ x, z, width, depth, seed })
    }
  })
})

describe('rule 5: a cap on the number of lots', () => {
  const zones = Array.from({ length: 36 }, (_, index) =>
    company(`c${index}`, {
      x: -125 + (index % 6) * 50,
      z: -125 + Math.floor(index / 6) * 50,
      width: 40,
      depth: 40
    })
  )
  const vast = floorOf({ width: 300, depth: 300 }, zones)

  it('never returns more than the cap, however large the floor', () => {
    const lots = surroundingLots(vast)
    expect(lots.length).toBeLessThanOrEqual(LOT_CAP)
    expect(lots.length).toBeGreaterThan(LOT_CAP / 2)
  })

  it('thins the ring evenly instead of dropping one side of it', () => {
    for (const [side, lots] of Object.entries(ringSides(vast)))
      expect(lots.length, side).toBeGreaterThan(4)
  })
})

describe('scene extent', () => {
  it('covers the plate, the apron and every lot', () => {
    const lots = surroundingLots(busy)
    const extent = sceneExtent(busy, lots)
    for (const rect of [plateOf(busy), apronOf(busy), ...lots]) {
      expect(rect.x - rect.width / 2).toBeGreaterThanOrEqual(extent.x - extent.width / 2 - 1e-9)
      expect(rect.x + rect.width / 2).toBeLessThanOrEqual(extent.x + extent.width / 2 + 1e-9)
      expect(rect.z - rect.depth / 2).toBeGreaterThanOrEqual(extent.z - extent.depth / 2 - 1e-9)
      expect(rect.z + rect.depth / 2).toBeLessThanOrEqual(extent.z + extent.depth / 2 + 1e-9)
    }
  })

  it('is the apron alone when there are no lots', () => {
    expect(sceneExtent(lone, [])).toEqual(apronOf(lone))
  })
})
