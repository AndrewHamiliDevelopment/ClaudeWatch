import { doorSide, SIDE_NORMAL, type WallSide } from '../logic/room-layout'
import { plateCentre } from '../logic/zone-framing'
import type { FloorGeometry, ZoneGeometry } from '../scene-model'

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

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>

// Where the ground plane lies and lots stand: under the slab and the district's lowest terrace.
export const GROUND_Y = -0.5
// What the floor theme's District, Hangar and Tower occupy around the plate. Lots stay off it.
export const WORLD_APRON = { west: 12, east: 12, north: 19, south: 8 }

const MAX_BUILDING_LOTS = 200
const MAX_PROP_LOTS = 80
export const LOT_CAP = MAX_BUILDING_LOTS + MAX_PROP_LOTS

// A thing of height h hides 1.43 h of ground behind it at the camera's 35° elevation.
const HEIGHT_PER_METRE = 0.7
export const MAX_LOT_HEIGHT_M = 24
const MIN_BUILDING_HEIGHT_M = 2
const MIN_PROP_HEIGHT_M = 0.4

// Buildings sit one to a block, on a grid that starts at their company's centre.
const BLOCK_M = 9
const STREET_M = 1
const BUILDING_SIDE_M = { min: 5, max: 7.5 }
const RING_DEPTH_M = 3 * BLOCK_M
// Ring lots this far past the apron are the far ring.
const FAR_RING_FROM_M = 2 * BLOCK_M
// The walkway the floor packs between companies; a building keeps this far from every company.
const LANE_M = 3

const PROP_SPACING_M = 5
const PROP_WALL_GAP_M = 0.2
const PROP_LENGTH_M = { min: 1, max: 2 }
const PROP_REACH_M = { min: 0.8, max: 1.1 }
// Left open past a prop, so a lane with props on it can still be walked.
const PROP_WALKWAY_M = 1.5

const DOOR_CLEAR_M = { ahead: 2, across: 4 }
const LIFT_CLEAR_M = 4

const SIDES: readonly WallSide[] = ['north', 'east', 'south', 'west']

function rectOf(west: number, east: number, north: number, south: number): Rect {
  return { x: (west + east) / 2, z: (north + south) / 2, width: east - west, depth: south - north }
}

function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2)
  const dz = Math.max(0, Math.abs(a.z - b.z) - (a.depth + b.depth) / 2)
  return Math.hypot(dx, dz)
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2
  )
}

function contains(outer: Rect, inner: Rect): boolean {
  return (
    Math.abs(inner.x - outer.x) + inner.width / 2 <= outer.width / 2 &&
    Math.abs(inner.z - outer.z) + inner.depth / 2 <= outer.depth / 2
  )
}

function grow(rect: Rect, metres: number): Rect {
  return { ...rect, width: rect.width + metres * 2, depth: rect.depth + metres * 2 }
}

// FNV-1a: the same text gives the same number on every machine and every start.
function hashOf(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// The nth value in [0, 1) drawn from a lot's seed.
function draw(seed: number, nth: number): number {
  let mixed = (seed + Math.imul(nth + 1, 0x9e3779b9)) | 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b)
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35)
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 0x100000000
}

const between = (range: { min: number; max: number }, share: number): number =>
  range.min + (range.max - range.min) * share

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
interface Anchor extends Rect {
  id: string
  zoneId: string | null
}

interface Site {
  plate: Rect
  apron: Rect
  ringEdge: Rect
  anchors: Anchor[]
  companies: ZoneGeometry[]
  // Zones, rooms, the corridor, the lift and the space in front of every door.
  blocked: Rect[]
  offices: Rect[]
}

function plateOf(floor: FloorGeometry): Rect {
  return { ...plateCentre(floor), width: floor.width, depth: floor.depth }
}

function apronOf(floor: FloorGeometry): Rect {
  const plate = plateOf(floor)
  return rectOf(
    plate.x - plate.width / 2 - WORLD_APRON.west,
    plate.x + plate.width / 2 + WORLD_APRON.east,
    plate.z - plate.depth / 2 - WORLD_APRON.north,
    plate.z + plate.depth / 2 + WORLD_APRON.south
  )
}

function surveySite(floor: FloorGeometry): Site {
  const plate = plateOf(floor)
  const apron = apronOf(floor)
  const zones = flatten(floor.zones)
  const companies = floor.zones
    .filter((zone) => zone.kind === 'company')
    .sort((a, b) => a.id.localeCompare(b.id))
  const projects = zones.filter((zone) => zone.kind === 'project')
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
    offices: projects.length > 0 ? projects : floor.rooms
  }
}

function heightLimit(rect: Rect, site: Site): number {
  const nearest = Math.min(...site.offices.map((office) => gapBetween(rect, office)))
  return Math.min(MAX_LOT_HEIGHT_M, nearest * HEIGHT_PER_METRE)
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
      const maxHeight = heightLimit(rect, site)
      if (maxHeight < MIN_BUILDING_HEIGHT_M) continue
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
      const maxHeight = heightLimit(rect, site)
      if (maxHeight < MIN_PROP_HEIGHT_M) continue
      lots.push({ id, kind: 'prop', ...rect, maxHeight, seed, zoneId: anchor.zoneId })
    }
  }
  return lots
}

// Over the cap, the plate's own lots stay and the ring is thinned by seed, so no side empties.
function capped(lots: readonly Lot[], limit: number, plate: Rect): Lot[] {
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
  const rects = [apronOf(floor), ...lots]
  return rectOf(
    Math.min(...rects.map((rect) => rect.x - rect.width / 2)),
    Math.max(...rects.map((rect) => rect.x + rect.width / 2)),
    Math.min(...rects.map((rect) => rect.z - rect.depth / 2)),
    Math.max(...rects.map((rect) => rect.z + rect.depth / 2))
  )
}
