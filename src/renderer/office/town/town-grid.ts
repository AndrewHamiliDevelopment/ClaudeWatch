import type { QualityLevel } from '../logic/quality'
import type { Rect } from '../themes/lot-math'

// Three nested lattices, all pinned at the gate (the floor's origin), so nothing on them moves.
export const LOT_PITCH_M = 12
// A block is 2 x 2 lots; collectors run on these lines.
export const BLOCK_PITCH_M = 24
// Park plots inside the claim.
export const GREEN_PITCH_M = 6

export const ROAD_WIDTH_M = { avenue: 12, boulevard: 10, collector: 6, lane: 2 } as const
export const SIDEWALK_M = { avenue: 1.5, boulevard: 1.5, collector: 1, lane: 0 } as const
export const AVENUE_MEDIAN_M = 3
// The boulevard (10) plus at least 3 m of green between it and the plate.
export const MIN_BELT_M = 13
// A held edge comes back in only once the campus needs this much less: more than a desk column.
export const CLAIM_RELEASE_M = 18
export const FAR_RING_FROM_M = 24
export const LOT_SIDE_MAX_M = 8
export const CLAIM_SETBACK_M = 1

export const RING_M: Record<QualityLevel, number> = { full: 48, balanced: 48, light: 24 }
export const OLD_TOWN_BLOCKS: Record<QualityLevel, number> = { full: 3, balanced: 3, light: 2 }
export const BUILDING_CAP: Record<QualityLevel, number> = { full: 200, balanced: 140, light: 90 }

// The square of a lattice whose north-west corner is (column, row) times the pitch.
export function cellRect(column: number, row: number, pitch: number): Rect {
  return { x: (column + 0.5) * pitch, z: (row + 0.5) * pitch, width: pitch, depth: pitch }
}

// Every line of a lattice from one edge to the other, both included.
export function latticeLines(from: number, to: number, pitch: number): number[] {
  const first = Math.ceil(from / pitch)
  const count = Math.floor(to / pitch) - first + 1
  // `+ 0` turns the -0 that `-1 * 0` would leave into 0, so plans compare equal.
  return Array.from({ length: Math.max(0, count) }, (_, index) => (first + index) * pitch + 0)
}
