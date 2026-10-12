import { RING_ROAD_M, STREET_CELL_M, streetRects, type StreetRect } from '../logic/streets'
import type { FloorGeometry } from '../scene-model'
import { draw, WORLD_APRON, type Lot } from '../themes/surroundings'
import type { CitizenRoute } from './route-pose'
import { routeFrom, streetGrid } from './street-grid'

// One for every 8 m of street round the offices: 31 round a lone company, the cap in the seeded
// town, which puts three or four in any close view. More than that and the ring road reads as a
// queue. Each costs one matrix a frame. Even, so half a share is a whole number.
export const CITIZEN_CAP = 48
const STREET_M_PER_CITIZEN = 8
// Paving reaches 2 m out from a building on each side: what a strip of it counts as one street.
const STREET_WIDTH_M = 4
// A start that leaves a citizen less than this to walk is drawn again, this many times at most.
const MIN_ROUTE_M = 10
const START_DRAWS = 8

export function streetLength(streets: readonly StreetRect[]): number {
  const area = streets.reduce((sum, street) => sum + street.width * street.depth, 0)
  return area / STREET_WIDTH_M
}

// `share` is the part of the town's citizens this machine's detail level can afford, 0 to 1.
export function citizenCount(streetMetres: number, share = 1): number {
  const full = Math.min(CITIZEN_CAP, Math.floor(streetMetres / STREET_M_PER_CITIZEN))
  return Math.round(full * Math.min(1, Math.max(0, share)))
}

// One number for the whole town: it changes only when a lot is added, moved or taken away.
function townSeed(lots: readonly Lot[]): number {
  let seed = 0x811c9dc5
  for (const lot of lots) {
    seed = Math.imul(seed ^ lot.seed, 0x01000193)
    seed = Math.imul(seed ^ Math.round(lot.x * 2), 0x01000193)
    seed = Math.imul(seed ^ Math.round(lot.z * 2), 0x01000193)
  }
  return seed >>> 0
}

// The streets citizens keep to: the open ground round the offices.
// `lots` is everything the streets were laid round: the same list Streets is drawn from.
export function citizenStreets(floor: FloorGeometry, lots: readonly Lot[]): StreetRect[] {
  const snap = (metres: number): number => Math.round(metres / STREET_CELL_M) * STREET_CELL_M
  // Citizens go no further out than the ring road: beyond it the blocks stand too tall and too
  // close for a figure this small to be seen between them.
  const west = snap(floor.x - floor.width / 2 - WORLD_APRON.west - RING_ROAD_M)
  const east = snap(floor.x + floor.width / 2 + WORLD_APRON.east + RING_ROAD_M)
  const north = snap(floor.z - floor.depth / 2 - WORLD_APRON.north - RING_ROAD_M)
  const south = snap(floor.z + floor.depth / 2 + WORLD_APRON.south + RING_ROAD_M)
  return streetRects(floor, lots).flatMap((street) => {
    const left = Math.max(west, street.x - street.width / 2)
    const right = Math.min(east, street.x + street.width / 2)
    const top = Math.max(north, street.z - street.depth / 2)
    const bottom = Math.min(south, street.z + street.depth / 2)
    if (right <= left || bottom <= top) return []
    const clipped = {
      x: (left + right) / 2,
      z: (top + bottom) / 2,
      width: right - left,
      depth: bottom - top
    }
    return [{ ...street, ...clipped }]
  })
}

// A smaller share sends out the first of the same citizens, on the same routes.
export function citizenRoutes(
  floor: FloorGeometry,
  lots: readonly Lot[],
  share = 1
): CitizenRoute[] {
  const streets = citizenStreets(floor, lots)
  const count = citizenCount(streetLength(streets), share)
  const grid = streetGrid(streets)
  if (count === 0 || grid.starts.length === 0) return []
  const seed = townSeed(lots)
  return Array.from({ length: count }, (_, index) => {
    const own = (seed ^ Math.imul(index + 1, 0x9e3779b1)) >>> 0
    const drawn = (attempt: number): CitizenRoute =>
      routeFrom(
        grid,
        grid.starts[Math.floor(draw(own + attempt, 0) * grid.starts.length)],
        own + attempt
      )
    let longest = drawn(0)
    for (let attempt = 1; attempt < START_DRAWS && longest.length < MIN_ROUTE_M; attempt++) {
      const route = drawn(attempt)
      if (route.length > longest.length) longest = route
    }
    return longest
  })
}
