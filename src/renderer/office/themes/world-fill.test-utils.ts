import { createElement } from 'react'
import { expect, it, vi } from 'vitest'
import { Group } from 'three'
import { makeSession } from '../__tests__/fixtures'
import { layoutFloor } from '../fixture/fixture-layout'
import { groupZonesByTheme } from '../logic/office-themes'
import type { FloorGeometry, LoungeGeometry } from '../scene-model'
import { FloorView } from '../scene/FloorView'
import { SurroundingsView, WorldView } from '../scene/WorldView'
import { registerTheme } from './registry'
import { everyElement, mergedDraws, type SceneElement } from './scene.test-utils'
import { surroundingLots, WORLD_APRON, type Lot } from './surroundings'
import type { OfficeTheme } from './types'
import { frameCallbacks } from './frame-capture.test-utils'
import { GATE, hangarStand, towerStand } from './apron'
import { DISTRICT_SIDES, HANGAR_SIDES, terraceLots } from './LotFill'
import { placeLot, type LotKit, type PlacedLot } from './lot-kit'
import { compactFloor, expectInsideLot, topOf } from './lot-box.test-utils'

// What one theme may add across its surroundings, lounge and ambient parts.
const FILL_DRAW_BUDGET = 9
const WORLD_DRAW_BUDGET = 60
const SEAT_CLEAR_M = 0.5
const AISLE_HALF_M = 2.4
const EPSILON = 1e-6

function crowdedFloor(): FloorGeometry {
  const sessions = Array.from({ length: 60 }, (_, index) =>
    makeSession({
      key: `claude:${index}`,
      provider: index % 2 ? 'codex' : 'claude',
      companyKey: `c_${index % 10}`,
      companyLabel: `Company ${index % 10}`,
      projectKey: `p_${index % 10}`,
      projectLabel: `Project ${index % 10}`
    })
  )
  return layoutFloor({ floorId: 'fill', label: 'Fill', plate: 1, sessions })
}

function named(elements: readonly SceneElement[], name: string): SceneElement[] {
  return elements.filter((element) => element.props.name === name)
}

interface Placement {
  position?: [number, number, number]
  scale?: [number, number, number]
  ref?: (node: Group | null) => void
}
const placement = (element: SceneElement): Placement => element.props as Placement

function expectLoungeIsClear(theme: OfficeTheme, lounge: LoungeGeometry): void {
  const Lounge = theme.kit.zone.Lounge
  if (!Lounge) throw new Error(`${theme.id} has no lounge`)
  const elements = everyElement(createElement(Lounge, { lounge }))
  const seats = named(elements, 'lounge-seat')
  expect(seats.map((seat) => placement(seat).position?.[0])).toEqual(
    lounge.seats.map((seat) => seat.x)
  )
  expect(seats.map((seat) => placement(seat).position?.[2])).toEqual(
    lounge.seats.map((seat) => seat.z)
  )
  for (const seat of seats)
    expect(everyElement(seat.props.children).some((part) => part.type === 'mesh')).toBe(true)

  const decor = named(elements, 'lounge-decor').flatMap((group) =>
    everyElement(group.props.children).filter((part) => part.type === 'mesh')
  )
  expect(decor.length).toBeGreaterThan(8)
  const lastRow = Math.max(...lounge.seats.map((seat) => seat.z))
  for (const part of decor) {
    const [x, , z] = placement(part).position ?? [0, 0, 0]
    const [sizeX, , sizeZ] = placement(part).scale ?? [0, 0, 0]
    const reachX = sizeX / 2
    const reachZ = sizeZ / 2
    expect(Math.abs(x - lounge.x) + reachX, 'decor leaves the lounge').toBeLessThanOrEqual(
      lounge.width / 2 + EPSILON
    )
    expect(Math.abs(z - lounge.z) + reachZ, 'decor leaves the lounge').toBeLessThanOrEqual(
      lounge.depth / 2 + EPSILON
    )
    // The seats and the way in from the door: from the door wall to past the last row.
    const isBesideSeats = Math.abs(x - lounge.x) - reachX >= AISLE_HALF_M
    const isPastSeats = z - reachZ >= lastRow + SEAT_CLEAR_M
    expect(isBesideSeats || isPastSeats, `decor at ${x}, ${z} stands in the way`).toBe(true)
  }
}

function moverPoses(
  theme: OfficeTheme,
  floor: FloorGeometry,
  moverNames: readonly string[],
  isReducedMotion: boolean
) {
  const Ambient = theme.kit.zone.Ambient
  if (!Ambient) throw new Error(`${theme.id} has no ambient part`)
  frameCallbacks.length = 0
  const lots = surroundingLots(floor)
  const elements = everyElement(createElement(Ambient, { floor, lots, isReducedMotion }))
  const invalidate = vi.fn()
  const movers = moverNames.map((name) => {
    const found = named(elements, name)
    expect(found.length, `${name} movers`).toBeGreaterThan(0)
    return found.map((element) => {
      const node = new Group()
      placement(element).ref?.(node)
      return node
    })
  })
  const poseAt = (elapsedTime: number): number[][] => {
    for (const callback of frameCallbacks) callback({ clock: { elapsedTime }, invalidate }, 0.016)
    return movers.map((group) =>
      group.flatMap((node) => [...node.position.toArray(), node.rotation.y, node.rotation.z])
    )
  }
  return { first: poseAt(0.7), second: poseAt(2.3), invalidate }
}

function fillDraws(theme: OfficeTheme, floor: FloorGeometry, lots: readonly Lot[]) {
  const bare: OfficeTheme = {
    ...theme,
    id: `test-bare-${theme.id}`,
    kit: { ...theme.kit, zone: { ...theme.kit.zone, Lounge: undefined } }
  }
  registerTheme(bare)
  const kitDraws = (drawn: OfficeTheme): number =>
    mergedDraws(
      createElement(FloorView, {
        floor,
        floorTheme: drawn,
        zoneGroups: groupZonesByTheme(floor, () => drawn.id),
        wallsMode: 'cutaway',
        isReducedMotion: true
      })
    ).untextured
  const surroundings = mergedDraws(
    createElement(SurroundingsView, {
      floor,
      floorTheme: theme,
      zoneGroups: groupZonesByTheme(floor, () => theme.id),
      lots,
      isReducedMotion: true
    })
  ).draws
  return { surroundings, lounge: kitDraws(theme) - kitDraws(bare) }
}

function expectApronIsFilled(kit: LotKit, width: number, depth: number): void {
  const floor = compactFloor(width, depth)
  const apron = terraceLots(floor, [...DISTRICT_SIDES, ...HANGAR_SIDES])
  const stands = [towerStand(floor), hangarStand(floor)]
  for (const lot of apron) {
    expectInsideLot(placeLot(lot, floor, kit))
    const outX = Math.abs(lot.x) - lot.width / 2 - width / 2
    const outZ = Math.abs(lot.z) - lot.depth / 2 - depth / 2
    // Past the slab, which overhangs the plate by half a metre.
    expect(Math.max(outX, outZ), `${lot.id} overlaps the plate`).toBeGreaterThanOrEqual(0.5)
    expect(lot.x - lot.width / 2).toBeGreaterThanOrEqual(-width / 2 - WORLD_APRON.west)
    expect(lot.x + lot.width / 2).toBeLessThanOrEqual(width / 2 + WORLD_APRON.east)
    expect(lot.z - lot.depth / 2).toBeGreaterThanOrEqual(-depth / 2 - WORLD_APRON.north)
    expect(lot.z + lot.depth / 2).toBeLessThanOrEqual(depth / 2 + WORLD_APRON.south)
    for (const stand of stands)
      expect(
        Math.abs(lot.x - stand.x) >= (lot.width + stand.width) / 2 ||
          Math.abs(lot.z - stand.z) >= (lot.depth + stand.depth) / 2,
        `${lot.id} stands on a landmark`
      ).toBe(true)
  }
  // No empty stretch: a lot in the first row at least every 8 m along each side of the plate.
  const firstRow = (side: string): number[] =>
    apron
      .filter((lot) => lot.side === side && lot.row === 0)
      .map((lot) => (side === 'north' || side === 'south' ? lot.x : lot.z))
      .sort((a, b) => a - b)
  for (const side of ['west', 'north', 'south']) {
    const spots = firstRow(side)
    expect(spots.length).toBeGreaterThanOrEqual(Math.floor((side === 'west' ? depth : width) / 8))
    // The south row opens for the gate's avenue.
    const widest = side === 'south' ? 8 + GATE.avenue : 8
    for (let index = 1; index < spots.length; index++)
      expect(spots[index] - spots[index - 1]).toBeLessThanOrEqual(widest)
  }
  expect(firstRow('east').length).toBeGreaterThanOrEqual(Math.floor(depth / 8) - 1)
}

// The checks every filled theme must pass; each theme's own test file calls this once.
export function describeWorldFill(
  theme: OfficeTheme,
  kit: LotKit,
  moverNames: readonly [string, string]
): void {
  const floor = crowdedFloor()
  const lots = surroundingLots(floor)
  const place = (lot: Lot): PlacedLot => placeLot(lot, floor, kit)

  it('offers at least four buildings and six props, each under its own name', () => {
    const names = [...kit.buildings, ...kit.props].map((design) => design.name)
    expect(kit.buildings.length).toBeGreaterThanOrEqual(4)
    expect(kit.props.length).toBeGreaterThanOrEqual(6)
    expect(new Set(names).size).toBe(names.length)
  })

  it('fills every lot, inside its footprint and under its height limit', () => {
    expect(lots.length).toBeGreaterThan(40)
    for (const lot of lots) expectInsideLot(place(lot))
  })

  it('puts at least four kinds of building and six kinds of prop on a full floor', () => {
    const used = (kind: Lot['kind']): number =>
      new Set(lots.filter((lot) => lot.kind === kind).map((lot) => place(lot).design)).size
    expect(used('building')).toBeGreaterThanOrEqual(4)
    expect(used('prop')).toBeGreaterThanOrEqual(6)
  })

  it('builds low beside the plate and tall where the lot allows', () => {
    const median = (values: number[]): number =>
      [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)]
    const besidePlate = terraceLots(floor, DISTRICT_SIDES)
      .filter((lot) => lot.row === 0)
      .map((lot) => topOf(placeLot(lot, floor, kit)))
    const ring = lots.filter((lot) => lot.kind === 'building').map((lot) => topOf(place(lot)))
    console.info(`${theme.id} tops: ${median(besidePlate)} m by the plate, ${median(ring)} m out`)
    expect(median(besidePlate)).toBeLessThan(median(ring))
    expect(Math.max(...ring)).toBeGreaterThan(8)
  })

  it('draws the same world on every start', () => {
    expect(lots.map(place)).toEqual(surroundingLots(crowdedFloor()).map(place))
  })

  it('registers all three parts on its zone kit', () => {
    const { Surroundings, Lounge, Ambient } = theme.kit.zone
    expect([Surroundings, Lounge, Ambient].every((part) => part !== undefined)).toBe(true)
  })

  it('seats every lounging agent and leaves the seats and the way in clear', () => {
    const lounges = floor.zones.flatMap((zone) => (zone.lounge ? [zone.lounge] : []))
    expect(lounges.length).toBeGreaterThan(0)
    for (const lounge of lounges) expectLoungeIsClear(theme, lounge)
  })

  it('moves two kinds of things without ever asking for a frame', () => {
    const { first, second, invalidate } = moverPoses(theme, floor, moverNames, false)
    expect(first[0]).not.toEqual(second[0])
    expect(first[1]).not.toEqual(second[1])
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('holds its moving things still under reduced motion', () => {
    const { first, second } = moverPoses(theme, floor, moverNames, true)
    expect(first).toEqual(second)
  })

  it('adds at most nine draws across its surroundings, lounge and ambient parts', () => {
    const { surroundings, lounge } = fillDraws(theme, floor, lots)
    console.info(`${theme.id} fill: ${surroundings} surroundings and ambient, ${lounge} lounge`)
    expect(surroundings).toBeGreaterThan(0)
    expect(surroundings + lounge).toBeLessThanOrEqual(FILL_DRAW_BUDGET)
    // Three merges of a full floor: slow when the suite runs beside other work.
  }, 30_000)

  it.each([
    [60, 50],
    [110, 85]
  ])('fills the apron of a %i x %i m floor without touching the plate', (width, depth) => {
    expectApronIsFilled(kit, width, depth)
  })

  it('still fits its district and hangar in the world draw budget', () => {
    const compact = compactFloor(110, 85)
    const world = mergedDraws(
      createElement(WorldView, {
        floor: compact,
        theme,
        band: 'building',
        floors: [{ floorId: compact.floorId, label: 'Fill', agentCount: 20, attentionCount: 1 }]
      })
    )
    console.info(`${theme.id} world: ${world.draws} draws, ${world.triangles} triangles`)
    expect(world.draws).toBeLessThanOrEqual(WORLD_DRAW_BUDGET)
  })
}
