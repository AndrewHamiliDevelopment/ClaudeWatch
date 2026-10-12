import type { Point } from '../../../office/sim/path'
import type { CitizenRoute, RoutePoint } from '../citizens/route-pose'
import { between, draw, hashOf, type Rect } from '../themes/lot-math'
import { reversed, roadNet, roadPath, type RoadNet } from './road-net'
import { gatePlaza } from './town-graph'
import { BLOCK_PITCH_M, ROAD_WIDTH_M } from './town-grid'
import type { TownLot } from './town-lots'
import type { TownPlan } from './town-plan'
import {
  MOVER_COUNTS,
  destinationOf,
  type Destination,
  type TownInput,
  type Trip
} from './town-trips'
import { INNER_SIDEWALK_M, closedLoop, secondsAt, sidePath } from './trip-paths'

const STROLL_M_PER_SEC = { min: 0.6, max: 1.2 }
const AWAY_SEC = { min: 8, max: 20 }
const HOME_SEC = { min: 4, max: 10 }
// No theme shows more of its figures than this, however much of the budget is free.
const FIGURES_PER_THEME = 4

// A citizen draws a home and somewhere to go this many times at most, and keeps the first pair
// whose walk is this much in the open; failing that, the most open of them.
const TRIP_DRAWS = 12
const OPEN_SHARE_WANTED = 0.75
const OPEN_SAMPLE_M = 0.5

// The draws a citizen's seed is spent on. Each try at a trip takes two from TRIP on.
const DRAW = { speed: 1, away: 2, home: 3, start: 4, trip: 5 }

// Where the avenue meets the boulevard: the paving a citizen may stand on in front of the gate.
export function plazaOf(claim: Rect): Rect {
  return { ...gatePlaza(claim), width: ROAD_WIDTH_M.boulevard, depth: ROAD_WIDTH_M.avenue }
}

interface Ground {
  plan: TownPlan
  net: RoadNet
  homes: TownLot[]
  lotsOf: Record<Exclude<Destination, 'plaza'>, TownLot[]>
  // Where a citizen is in plain sight: the promenades, the parks and the plaza.
  open: Rect[]
  crossings: Set<string>
  // On the boulevard's inner sidewalk in front of the gate: as near the campus as anyone comes.
  plazaStand: Point
}

function groundOf(plan: TownPlan): Ground {
  const sorted = [...plan.lots].sort((a, b) => a.id.localeCompare(b.id))
  const inZone = (zone: TownLot['zone']): TownLot[] => sorted.filter((lot) => lot.zone === zone)
  const plaza = gatePlaza(plan.claim)
  return {
    plan,
    net: roadNet(plan, 'citizen'),
    homes: inZone('residential'),
    lotsOf: {
      market: inZone('market'),
      entertainment: inZone('entertainment'),
      park: inZone('park'),
      civic: inZone('civic')
    },
    open: [...plan.promenades, plazaOf(plan.claim)],
    crossings: new Set(plan.graph.nodes.map((node) => `${node.x}:${node.z}`)),
    plazaStand: { x: plaza.x + INNER_SIDEWALK_M, z: plaza.z }
  }
}

// Where a citizen bound for `destination` ends up: a door, the middle of a park, or the plaza.
function goalOf(ground: Ground, destination: Destination, pick: number): Point {
  if (destination === 'plaza') return ground.plazaStand
  const lots = ground.lotsOf[destination]
  if (lots.length === 0) return ground.plazaStand
  const lot = lots[Math.floor(pick * lots.length)]
  if (destination !== 'park') return lot.door
  // A park is walked into: where its two footpaths cross, when the claim has not cut it off.
  const [column, row] = lot.blockId.split(':').slice(1).map(Number)
  const middle = { x: (column + 0.5) * BLOCK_PITCH_M, z: (row + 0.5) * BLOCK_PITCH_M }
  return ground.crossings.has(`${middle.x}:${middle.z}`) ? middle : lot.door
}

function openShare(points: readonly RoutePoint[], open: readonly Rect[]): number {
  let inTheOpen = 0
  let samples = 0
  for (let index = 1; index < points.length; index++) {
    const [from, to] = [points[index - 1], points[index]]
    const steps = Math.ceil(Math.hypot(to.x - from.x, to.z - from.z) / OPEN_SAMPLE_M)
    for (let step = 0; step < steps; step++) {
      const x = from.x + ((to.x - from.x) * step) / steps
      const z = from.z + ((to.z - from.z) * step) / steps
      samples++
      if (
        open.some(
          (rect) => Math.abs(x - rect.x) <= rect.width / 2 && Math.abs(z - rect.z) <= rect.depth / 2
        )
      )
        inTheOpen++
    }
  }
  return samples === 0 ? 0 : inTheOpen / samples
}

interface Walk {
  home: TownLot
  out: RoutePoint[]
  back: RoutePoint[]
  openShare: number
}

function walkBetween(ground: Ground, home: TownLot, goal: Point): Walk | null {
  const legs = roadPath(ground.net, home.door, goal)
  if (!legs || legs.length === 0) return null
  const { claim } = ground.plan
  const out = [home.door, ...sidePath(legs, claim, 'citizen'), goal]
  const back = sidePath(reversed(legs), claim, 'citizen')
  return { home, out, back, openShare: openShare([...out, ...back, home.door], ground.open) }
}

function walkOf(ground: Ground, seed: number, destination: Destination): Walk | null {
  let best: Walk | null = null
  for (let attempt = 0; attempt < TRIP_DRAWS; attempt++) {
    const home = ground.homes[Math.floor(draw(seed, DRAW.trip + attempt * 2) * ground.homes.length)]
    const goal = goalOf(ground, destination, draw(seed, DRAW.trip + attempt * 2 + 1))
    const walk = walkBetween(ground, home, goal)
    if (walk && walk.openShare >= OPEN_SHARE_WANTED) return walk
    if (walk && walk.openShare > (best?.openShare ?? -1)) best = walk
  }
  return best
}

// Citizen `n` of the town: it lives at a residential lot, walks to where its seed sends it by
// the cheapest way that keeps it in sight, waits, and walks home on the other side of the road.
export function citizenTrips(town: TownInput, count: number): Trip[] {
  const ground = groundOf(town.plan)
  if (ground.homes.length === 0) return []
  const walked = Array.from({ length: count }, (_, index) => {
    const seed = hashOf(`citizen:${index}`)
    const destination = destinationOf(seed)
    return { seed, destination, walk: walkOf(ground, seed, destination) }
  })
  const themeOf = (home: TownLot): string =>
    town.themeIdByZone.get(town.owners.get(home.id) ?? '') ?? town.floorThemeId
  // Past the budget a theme has no draw left: its streets get the floor's townsfolk.
  const budget = MOVER_COUNTS[town.detail].citizenKinds
  const drawn = [
    ...new Set([
      town.floorThemeId,
      ...walked.flatMap(({ walk }) => (walk ? [themeOf(walk.home)] : []))
    ])
  ].slice(0, budget)
  const slots = Math.max(1, Math.min(FIGURES_PER_THEME, Math.floor(budget / drawn.length)))
  const countByTheme = new Map<string, number>()

  return walked.flatMap(({ seed, destination, walk }): Trip[] => {
    if (!walk) return []
    const owner = themeOf(walk.home)
    const themeId = drawn.includes(owner) ? owner : town.floorThemeId
    const rank = countByTheme.get(themeId) ?? 0
    countByTheme.set(themeId, rank + 1)
    const speed = between(STROLL_M_PER_SEC, draw(seed, DRAW.speed))
    const isOutdoors = destination === 'park' || destination === 'plaza'
    const route: CitizenRoute = closedLoop(
      walk.out,
      walk.back,
      { sec: between(AWAY_SEC, draw(seed, DRAW.away)), isIndoors: !isOutdoors },
      { sec: between(HOME_SEC, draw(seed, DRAW.home)), isIndoors: true }
    )
    return [
      {
        kind: 'citizen',
        themeId,
        figure: rank % slots,
        route,
        speed,
        startSec: secondsAt(route, speed, draw(seed, DRAW.start)),
        homeId: walk.home.id,
        destination
      }
    ]
  })
}
