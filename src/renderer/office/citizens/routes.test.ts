import { describe, expect, it } from 'vitest'
import { buildFixtureFrame } from '../fixture/fixture-feed'
import { districtLots } from '../player/district-lots'
import type { FloorGeometry } from '../scene-model'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import { DEFAULT_THEME_ID } from '../themes/registry'
import { surroundingLots, type Lot } from '../themes/surroundings'
import { HOLD_RADIUS_M, routePose, walkedSec, type CitizenRoute } from './route-pose'
import { CITIZEN_CAP, citizenCount, citizenRoutes, citizenStreets, streetLength } from './routes'

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>

const SAMPLE_M = 0.25
const EDGE_EPSILON_M = 1e-6

function townOf(floor: FloorGeometry) {
  const solids = [...surroundingLots(floor), ...districtLots(DEFAULT_THEME_ID, floor)]
  return { floor, solids, streets: citizenStreets(floor, solids) }
}

const TOWNS: readonly (readonly [string, ReturnType<typeof townOf>])[] = [
  ['the seeded floor', townOf(buildFixtureFrame(0, 0).floors[0])],
  ...LIVE_FLOORS.map(([name, floor]) => [name, townOf(floor)] as const)
]

function isInside(rect: Rect, point: { x: number; z: number }): boolean {
  return (
    Math.abs(point.x - rect.x) < rect.width / 2 - EDGE_EPSILON_M &&
    Math.abs(point.z - rect.z) < rect.depth / 2 - EDGE_EPSILON_M
  )
}

function isOn(rect: Rect, point: { x: number; z: number }): boolean {
  return (
    Math.abs(point.x - rect.x) <= rect.width / 2 + EDGE_EPSILON_M &&
    Math.abs(point.z - rect.z) <= rect.depth / 2 + EDGE_EPSILON_M
  )
}

// Every quarter metre of the walk, out and back.
function samplesOf(route: CitizenRoute): { x: number; z: number }[] {
  const samples: { x: number; z: number }[] = []
  for (let travelled = 0; travelled <= route.length * 2; travelled += SAMPLE_M)
    samples.push(routePose(route, travelled))
  return samples
}

describe('citizenCount', () => {
  it('is none where there are no streets', () => {
    expect(citizenCount(0)).toBe(0)
    expect(streetLength([])).toBe(0)
  })

  it('grows with the length of street', () => {
    expect(citizenCount(200)).toBeGreaterThan(0)
    expect(citizenCount(600)).toBeGreaterThan(citizenCount(200))
  })

  it('never passes the cap', () => {
    expect(citizenCount(1e9)).toBe(CITIZEN_CAP)
  })

  it('scales with the share of the town the machine can afford', () => {
    expect(citizenCount(1e9, 0.5)).toBe(CITIZEN_CAP / 2)
    expect(citizenCount(1e9, 0)).toBe(0)
    expect(citizenCount(1e9, 7)).toBe(CITIZEN_CAP)
    expect(citizenCount(1e9, -1)).toBe(0)
  })
})

describe.each(TOWNS)('citizenRoutes on %s', (_name, { floor, solids, streets }) => {
  const routes = citizenRoutes(floor, solids)

  it('sends out as many citizens as the streets are long', () => {
    expect(routes).toHaveLength(citizenCount(streetLength(streets)))
    expect(routes.length).toBeGreaterThan(0)
  })

  it('keeps every step on a street', () => {
    for (const route of routes)
      for (const sample of samplesOf(route))
        expect(streets.some((street) => isOn(street, sample))).toBe(true)
  })

  it('never steps inside a lot or a company', () => {
    const closed: Rect[] = [...solids, ...floor.zones]
    for (const route of routes)
      for (const sample of samplesOf(route))
        expect(closed.some((rect) => isInside(rect, sample))).toBe(false)
  })

  it('walks some of them through the campus, in the open beside the offices', () => {
    const plate = { x: floor.x, z: floor.z, width: floor.width, depth: floor.depth }
    const strollers = routes.filter((route) =>
      samplesOf(route).some((sample) => isInside(plate, sample))
    )
    expect(strollers.length).toBeGreaterThanOrEqual(3)
  })

  it('gives the same town the same routes', () => {
    expect(citizenRoutes(floor, [...solids])).toEqual(routes)
  })

  it('gives most citizens somewhere to go', () => {
    const walkers = routes.filter((route) => route.length >= 6)
    expect(walkers.length).toBeGreaterThanOrEqual(routes.length * 0.8)
  })

  it('sends fewer out when the machine can afford a smaller share', () => {
    const half = citizenRoutes(floor, solids, 0.5)
    expect(half.length).toBe(citizenCount(streetLength(streets), 0.5))
    expect(half).toEqual(routes.slice(0, half.length))
    expect(half.length).toBeLessThan(routes.length)
  })
})

describe('routePose', () => {
  const route: CitizenRoute = {
    points: [
      { x: 0, z: 0 },
      { x: 4, z: 0 },
      { x: 4, z: 3 }
    ],
    length: 7
  }

  it('starts at the first point, facing the way it will go', () => {
    expect(routePose(route, 0)).toMatchObject({ x: 0, z: 0, heading: Math.PI / 2 })
  })

  it('turns the corner', () => {
    expect(routePose(route, 5)).toMatchObject({ x: 4, z: 1, heading: 0 })
  })

  it('walks back the way it came, facing back', () => {
    const back = routePose(route, 9)
    expect(back).toMatchObject({ x: 4, z: 1 })
    expect(Math.abs(back.heading)).toBeCloseTo(Math.PI)
    expect(routePose(route, 14)).toMatchObject({ x: 0, z: 0 })
  })

  it('stands still on a route with nowhere to go', () => {
    const stuck: CitizenRoute = { points: [{ x: 2, z: 5 }], length: 0 }
    expect(routePose(stuck, 30)).toMatchObject({ x: 2, z: 5, heading: 0 })
  })
})

describe('walkedSec', () => {
  const route: CitizenRoute = {
    points: [
      { x: 0, z: 0 },
      { x: 10, z: 0 }
    ],
    length: 10
  }

  it('walks on by the time the frame took', () => {
    expect(walkedSec({ route, speed: 1, walked: 2, deltaSec: 0.5, player: null })).toBe(2.5)
  })

  it('waits rather than step into the player', () => {
    const player = { x: 3, z: 0 }
    const walked = 3 - HOLD_RADIUS_M - 0.01
    expect(walkedSec({ route, speed: 1, walked, deltaSec: 0.1, player })).toBe(walked)
  })

  it('walks on once the player is out of the way', () => {
    const player = { x: 3, z: 4 }
    expect(walkedSec({ route, speed: 1, walked: 2, deltaSec: 0.5, player })).toBe(2.5)
  })
})
