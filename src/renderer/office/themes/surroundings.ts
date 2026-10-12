import { doorSide, SIDE_NORMAL, type WallSide } from '../logic/room-layout'
import type { FloorGeometry, ZoneGeometry } from '../scene-model'
import {
  between,
  contains,
  draw,
  gapBetween,
  grow,
  hashOf,
  overlaps,
  rectOf,
  type Rect
} from './lot-math'

// The one seeded pick and the one gap measure every theme shares.
export { draw, gapBetween, hashOf }

export interface Lot {
  id: string
  kind: 'building' | 'prop'
  // Centre of the footprint, in floor-local metres like every zone.
  x: number
  z: number
  width: number
  depth: number
  // The highest y anything on the lot may reach, so it never hides a desk at any map rotation.
  maxHeight: number
  // A stable 32-bit number for the theme to pick a design from.
  seed: number
  // The company the lot belongs to (the nearest one); null for the far ring the floor theme draws.
  zoneId: string | null
}

// Where the ground plane lies and lots stand: under the slab and the district's lowest terrace.
export const GROUND_Y = -0.5
// What the floor theme's District, Hangar and Tower occupy around the plate. Lots stay off it.
export const WORLD_APRON = { west: 12, east: 12, north: 19, south: 8 }

const MAX_BUILDING_LOTS = 200
const MAX_PROP_LOTS = 80
export const LOT_CAP = MAX_BUILDING_LOTS + MAX_PROP_LOTS

// A thing of height h hides 1.43 h of ground behind it at the camera's 35° elevation.
export const HEIGHT_PER_METRE = 0.7
export const MAX_LOT_HEIGHT_M = 24
// The lowest limit a lot is still worth building under, by kind.
export const MIN_LOT_HEIGHT_M = { building: 2, prop: 0.4 }

// Buildings sit one to a block, on a grid that starts at their company's centre.
const BLOCK_M = 9
const STREET_M = 1
const BUILDING_SIDE_M = { min: 5, max: 7.5 }
const RING_DEPTH_M = 3 * BLOCK_M
// Ring lots this far past the apron are the far ring.
const FAR_RING_FROM_M = 2 * BLOCK_M
// The walkway the floor packs between companies; a building keeps this far from every company.
export const LANE_M = 3

const PROP_SPACING_M = 5
const PROP_WALL_GAP_M = 0.2
const PROP_LENGTH_M = { min: 1, max: 2 }
const PROP_REACH_M = { min: 0.8, max: 1.1 }
// Left open past a prop, so a lane with props on it can still be walked.
const PROP_WALKWAY_M = 1.5

const DOOR_CLEAR_M = { ahead: 2, across: 4 }
const LIFT_CLEAR_M = 4

const SIDES: readonly WallSide[] = ['north', 'east', 'south', 'west']

function flatten(zones: readonly ZoneGeometry[]): ZoneGeometry[] {
  return zones.flatMap((zone) => [zone, ...flatten(zone.children)])
}

function doorClearance(rect: Rect & { door: { x: number; z: number } }): Rect {
  const normal = SIDE_NORMAL[doorSide(rect)]
  const { ahead, across } = DOOR_CLEAR_M
  return {
    x: rect.door.x + (normal.x * ahead) / 2,
    z: rect.door.z + (normal.z * ahead) / 2,
    width: normal.x === 0 ? across : ahead,
    depth: normal.z === 0 ? across : ahead
  }
}

// What lots are grown around: a company, or the bare plate on a floor that has none yet.
export interface Anchor extends Rect {
  id: string
  zoneId: string | null
}

export interface Site {
  plate: Rect
  apron: Rect
  ringEdge: Rect
  anchors: Anchor[]
  companies: ZoneGeometry[]
  // Zones, rooms, the corridor, the lift and the space in front of every door.
  blocked: Rect[]
  offices: Rect[]
}

// The band round the plate that the floor theme's District, Hangar and Tower fill.
export function apronOf(plate: Rect): Rect {
  return rectOf(
    plate.x - plate.width / 2 - WORLD_APRON.west,
    plate.x + plate.width / 2 + WORLD_APRON.east,
    plate.z - plate.depth / 2 - WORLD_APRON.north,
    plate.z + plate.depth / 2 + WORLD_APRON.south
  )
}

// What nothing may hide: the project offices, else the leaf rooms, else the bare plate.
export function officesOf(floor: FloorGeometry): Rect[] {
  const projects = flatten(floor.zones).filter((zone) => zone.kind === 'project')
  if (projects.length > 0) return projects
  return floor.rooms.length > 0 ? floor.rooms : [floor]
}

// The highest y a thing standing on `rect` may reach without hiding a desk at any map rotation.
export function heightLimit(rect: Rect, offices: readonly Rect[]): number {
  const nearest = Math.min(...offices.map((office) => gapBetween(rect, office)))
  return Math.min(MAX_LOT_HEIGHT_M, nearest * HEIGHT_PER_METRE)
}

// A lot on the plate stands on the slab; every other lot stands on the ground.
export function lotBase(lot: Rect, plate: Rect): number {
  return contains(plate, lot) ? 0 : GROUND_Y
}

export function surveySite(floor: FloorGeometry): Site {
  const plate: Rect = floor
  const apron = apronOf(plate)
  const zones = flatten(floor.zones)
  const companies = floor.zones
    .filter((zone) => zone.kind === 'company')
    .sort((a, b) => a.id.localeCompare(b.id))
  const doors = [...zones, ...floor.rooms].flatMap((rect) =>
    rect.door ? [doorClearance({ ...rect, door: rect.door })] : []
  )
  return {
    plate,
    apron,
    ringEdge: grow(apron, RING_DEPTH_M),
    anchors:
      companies.length > 0
        ? companies.map((zone) => ({ ...zone, zoneId: zone.id }))
        : [{ ...plate, id: floor.floorId, zoneId: null }],
    companies,
    blocked: [
      ...zones,
      ...floor.rooms,
      ...doors,
      { x: plate.x, z: floor.corridor.z, width: floor.width, depth: floor.corridor.width },
      { x: floor.elevator.x, z: floor.elevator.z, width: LIFT_CLEAR_M, depth: LIFT_CLEAR_M }
    ],
    offices: officesOf(floor)
  }
}

function isNearestAnchor(rect: Rect, anchor: Anchor, site: Site): boolean {
  const own = gapBetween(rect, anchor)
  return site.anchors.every((other, index) => {
    const distance = gapBetween(rect, other)
    // A tie goes to the anchor that sorts first.
    return distance > own || (distance === own && index >= site.anchors.indexOf(anchor))
  })
}

function buildingCandidates(anchor: Anchor, site: Site): Lot[] {
  const lots: Lot[] = []
  const edge = site.ringEdge
  const firstColumn = Math.ceil((edge.x - edge.width / 2 - anchor.x) / BLOCK_M)
  const lastColumn = Math.floor((edge.x + edge.width / 2 - anchor.x) / BLOCK_M)
  const firstRow = Math.ceil((edge.z - edge.depth / 2 - anchor.z) / BLOCK_M)
  const lastRow = Math.floor((edge.z + edge.depth / 2 - anchor.z) / BLOCK_M)
  for (let column = firstColumn; column <= lastColumn; column++) {
    for (let row = firstRow; row <= lastRow; row++) {
      const id = `${anchor.id}:lot:${column}:${row}`
      const seed = hashOf(id)
      const width = between(BUILDING_SIDE_M, draw(seed, 0))
      const depth = between(BUILDING_SIDE_M, draw(seed, 1))
      const rect: Rect = {
        x: anchor.x + column * BLOCK_M + (draw(seed, 2) - 0.5) * (BLOCK_M - STREET_M - width),
        z: anchor.z + row * BLOCK_M + (draw(seed, 3) - 0.5) * (BLOCK_M - STREET_M - depth),
        width,
        depth
      }
      const isOnPlate = contains(site.plate, rect)
      if (!isOnPlate && (overlaps(rect, site.apron) || !contains(edge, rect))) continue
      if (site.companies.some((zone) => gapBetween(rect, zone) < LANE_M)) continue
      if (site.blocked.some((solid) => overlaps(rect, solid))) continue
      if (!isNearestAnchor(rect, anchor, site)) continue
      const maxHeight = heightLimit(rect, site.offices)
      if (maxHeight < MIN_LOT_HEIGHT_M.building) continue
      const isFarRing = !isOnPlate && gapBetween(rect, site.apron) >= FAR_RING_FROM_M
      lots.push({
        id,
        kind: 'building',
        ...rect,
        maxHeight,
        seed,
        zoneId: isFarRing ? null : anchor.zoneId
      })
    }
  }
  return lots
}

function propCandidates(anchor: Anchor, site: Site): Lot[] {
  if (anchor.zoneId === null) return []
  const lots: Lot[] = []
  for (const side of SIDES) {
    const normal = SIDE_NORMAL[side]
    const isAlongX = normal.x === 0
    const wallLength = isAlongX ? anchor.width : anchor.depth
    const wallOffset = (isAlongX ? anchor.depth : anchor.width) / 2
    const last = Math.floor((wallLength / 2 - PROP_LENGTH_M.max) / PROP_SPACING_M)
    for (let step = -last; step <= last; step++) {
      const id = `${anchor.id}:prop:${side}:${step}`
      const seed = hashOf(id)
      const length = between(PROP_LENGTH_M, draw(seed, 0))
      const reach = between(PROP_REACH_M, draw(seed, 1))
      const out = wallOffset + PROP_WALL_GAP_M + reach / 2
      const along = step * PROP_SPACING_M
      const rect: Rect = {
        x: anchor.x + normal.x * out + (isAlongX ? along : 0),
        z: anchor.z + normal.z * out + (isAlongX ? 0 : along),
        width: isAlongX ? length : reach,
        depth: isAlongX ? reach : length
      }
      if (!contains(site.plate, rect)) continue
      if (site.blocked.some((solid) => overlaps(rect, solid))) continue
      const isCrowded = site.companies.some(
        (zone) => zone.id !== anchor.id && gapBetween(rect, zone) < PROP_WALKWAY_M
      )
      if (isCrowded) continue
      const maxHeight = heightLimit(rect, site.offices)
      if (maxHeight < MIN_LOT_HEIGHT_M.prop) continue
      lots.push({ id, kind: 'prop', ...rect, maxHeight, seed, zoneId: anchor.zoneId })
    }
  }
  return lots
}

// Over the cap, the plate's own lots stay and the ring is thinned by seed, so no side empties.
export function capped(lots: readonly Lot[], limit: number, plate: Rect): Lot[] {
  if (lots.length <= limit) return [...lots]
  const rank = (lot: Lot): number => (contains(plate, lot) ? 0 : 1)
  const kept = new Set(
    [...lots].sort((a, b) => rank(a) - rank(b) || a.seed - b.seed).slice(0, limit)
  )
  return lots.filter((lot) => kept.has(lot))
}

// Building lots ring the floor and fill the wide gaps between companies; prop spots line the
// outside of company walls. Every lot grows from one company, so it stays put while others change.
export function surroundingLots(floor: FloorGeometry): Lot[] {
  const site = surveySite(floor)
  const placed: Lot[] = []
  const place = (candidates: readonly Lot[], clearance: number): void => {
    for (const lot of candidates)
      if (!placed.some((other) => overlaps(grow(lot, clearance), other))) placed.push(lot)
  }
  for (const anchor of site.anchors) {
    place(propCandidates(anchor, site), PROP_WALKWAY_M)
    place(buildingCandidates(anchor, site), 0)
  }
  return [
    ...capped(
      placed.filter((lot) => lot.kind === 'prop'),
      MAX_PROP_LOTS,
      site.plate
    ),
    ...capped(
      placed.filter((lot) => lot.kind === 'building'),
      MAX_BUILDING_LOTS,
      site.plate
    )
  ]
}

// The box around everything drawn on the ground: what the camera's planes are sized from.
export function sceneExtent(floor: FloorGeometry, lots: readonly Lot[]): Rect {
  const rects: Rect[] = [apronOf(floor), ...lots]
  return rectOf(
    Math.min(...rects.map((rect) => rect.x - rect.width / 2)),
    Math.max(...rects.map((rect) => rect.x + rect.width / 2)),
    Math.min(...rects.map((rect) => rect.z - rect.depth / 2)),
    Math.max(...rects.map((rect) => rect.z + rect.depth / 2))
  )
}
