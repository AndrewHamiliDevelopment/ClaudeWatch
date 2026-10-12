import type { LoungeGeometry } from '../scene-model'

export interface Footprint {
  x: number
  z: number
  width: number
  depth: number
}

// Kept free around a seat and around the straight walk from the door to it.
const BODY_CLEAR_M = 0.55
const WALK_STEPS = 24
const WALL_GAP_M = 0.15

function gapTo(spot: Footprint, x: number, z: number): number {
  const dx = Math.max(0, Math.abs(x - spot.x) - spot.width / 2)
  const dz = Math.max(0, Math.abs(z - spot.z) - spot.depth / 2)
  return Math.hypot(dx, dz)
}

function overlaps(a: Footprint, b: Footprint): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2
  )
}

function isWalkable(lounge: LoungeGeometry, spot: Footprint): boolean {
  return lounge.seats.every((seat) =>
    Array.from({ length: WALK_STEPS + 1 }, (_, step) => step / WALK_STEPS).every(
      (share) =>
        gapTo(
          spot,
          lounge.door.x + (seat.x - lounge.door.x) * share,
          lounge.door.z + (seat.z - lounge.door.z) * share
        ) >= BODY_CLEAR_M
    )
  )
}

// Where furniture of a given size may stand: against a wall or in a corner of the lounge, as
// shares of its width and depth (-1 west or north, 1 east or south).
export function spotAt(
  lounge: LoungeGeometry,
  across: number,
  along: number,
  width: number,
  depth: number
): Footprint {
  return {
    x: lounge.x + across * (lounge.width / 2 - width / 2 - WALL_GAP_M),
    z: lounge.z + along * (lounge.depth / 2 - depth / 2 - WALL_GAP_M),
    width,
    depth
  }
}

// The first spot no agent sits on or walks through, and nothing already placed stands on.
export function firstClear(
  lounge: LoungeGeometry,
  spots: readonly Footprint[],
  taken: readonly Footprint[] = []
): Footprint | null {
  return (
    spots.find(
      (spot) => isWalkable(lounge, spot) && !taken.some((other) => overlaps(spot, other))
    ) ?? null
  )
}
