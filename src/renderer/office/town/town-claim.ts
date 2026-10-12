import { boundsOfZone } from '../logic/zone-framing'
import { contains, rectOf, type Rect } from '../themes/lot-math'
import { CLAIM_RELEASE_M, LOT_PITCH_M, MIN_BELT_M } from './town-grid'

// A fresh edge is snapped with this much to spare. It is the release distance less one lot, so
// an edge that grew and came back lands on the line a first start would pick: no running maximum.
const FRESH_SPARE_M = CLAIM_RELEASE_M - LOT_PITCH_M

// +1 for the edges that grow toward +x and +z (east, south), -1 for west and north.
type Outward = 1 | -1

// The plate grown by the belt, not snapped: what the campus needs.
export function neededClaim(plate: Rect): Rect {
  return {
    x: plate.x,
    z: plate.z,
    width: plate.width + MIN_BELT_M * 2,
    depth: plate.depth + MIN_BELT_M * 2
  }
}

function snapped(needed: number, outward: Outward): number {
  // `+ 0` keeps a -0 out of the claim, so claims compare equal.
  return outward * Math.ceil((outward * needed + FRESH_SPARE_M) / LOT_PITCH_M) * LOT_PITCH_M + 0
}

function settled(needed: number, held: number | null, outward: Outward): number {
  if (held === null) return snapped(needed, outward)
  const spare = (held - needed) * outward
  return spare >= 0 && spare < CLAIM_RELEASE_M ? held : snapped(needed, outward)
}

// The campus's rectangle on the 12 m lines. `held` is the last floor's claim, or null on a first
// start; each edge stays where it is held until the campus passes it or needs 18 m less.
export function campusClaim(needed: Rect, held: Rect | null): Rect {
  const want = boundsOfZone(needed)
  const keep = held ? boundsOfZone(held) : null
  return rectOf(
    settled(want.minX, keep?.minX ?? null, -1),
    settled(want.maxX, keep?.maxX ?? null, 1),
    settled(want.minZ, keep?.minZ ?? null, -1),
    settled(want.maxZ, keep?.maxZ ?? null, 1)
  )
}

function isLotLine(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value % LOT_PITCH_M === 0
}

// A claim read back from storage: four edges on the 12 m lines that still contain what the
// campus needs. Anything else is dropped, never coerced, and the town starts afresh.
export function heldClaim(stored: unknown, needed: Rect): Rect | null {
  if (typeof stored !== 'object' || stored === null) return null
  if (!('west' in stored && 'east' in stored && 'north' in stored && 'south' in stored)) return null
  const { west, east, north, south } = stored
  if (!isLotLine(west) || !isLotLine(east) || !isLotLine(north) || !isLotLine(south)) return null
  const claim = rectOf(west, east, north, south)
  return contains(claim, needed) ? claim : null
}
