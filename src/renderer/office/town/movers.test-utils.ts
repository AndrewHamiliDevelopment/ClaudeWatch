import { routePose, type CitizenPose } from '../citizens/route-pose'
import { buildFixtureFrame } from '../fixture/fixture-feed'
import type { QualityLevel } from '../logic/quality'
import type { FloorGeometry } from '../scene-model'
import type { Rect } from '../themes/lot-math'
import { DEFAULT_THEME_ID, listThemes } from '../themes/registry'
import { campusClaim, neededClaim } from './town-claim'
import { lotOwners, townBlocks } from './town-plan'
import type { TownSize } from './town-grid'
import type { TownInput, Trip } from './town-trips'
import { LARGE_FLOOR } from './town.test-utils'

export const MOVER_FLOORS: readonly (readonly [string, FloorGeometry])[] = [
  ['the seeded floor', buildFixtureFrame(0, 0).floors[0]],
  ['the three-company floor', LARGE_FLOOR]
]

// The town a floor gets on a first start, each company dressed in a theme of its own.
export function townOn(
  floor: FloorGeometry,
  detail: QualityLevel = 'full',
  size: TownSize = 'city'
): TownInput {
  const plan = townBlocks(campusClaim(neededClaim(floor), null), detail, size)
  const themes = listThemes()
  const companies = floor.zones.filter((zone) => zone.kind === 'company')
  return {
    plan,
    owners: lotOwners(plan, floor.zones),
    floorThemeId: DEFAULT_THEME_ID,
    themeIdByZone: new Map(
      companies.map((zone, index) => [zone.id, themes[index % themes.length].id] as const)
    ),
    detail
  }
}

const SAMPLE_M = 0.25

// Every quarter metre of one lap of the ground a mover covers, waits left out.
export function lapOf(trip: Trip): CitizenPose[] {
  const ground = { ...trip.route, stops: [] }
  const poses: CitizenPose[] = []
  for (let metres = 0; metres < trip.route.length; metres += SAMPLE_M)
    poses.push(routePose(ground, metres))
  return poses
}

// Where a mover is `sec` seconds after the scene opens.
export function poseAfter(trip: Trip, sec: number): CitizenPose {
  return routePose(trip.route, (trip.startSec + sec) * trip.speed, trip.speed)
}

const EDGE_EPSILON_M = 1e-6

export function isWithin(rect: Rect, point: { x: number; z: number }): boolean {
  return (
    Math.abs(point.x - rect.x) < rect.width / 2 - EDGE_EPSILON_M &&
    Math.abs(point.z - rect.z) < rect.depth / 2 - EDGE_EPSILON_M
  )
}

export function isOn(rect: Rect, point: { x: number; z: number }): boolean {
  return (
    Math.abs(point.x - rect.x) <= rect.width / 2 + EDGE_EPSILON_M &&
    Math.abs(point.z - rect.z) <= rect.depth / 2 + EDGE_EPSILON_M
  )
}
