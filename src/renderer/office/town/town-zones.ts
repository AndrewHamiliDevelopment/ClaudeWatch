import { draw, hashOf } from '../themes/lot-math'
import { MAX_LOT_HEIGHT_M } from '../themes/surroundings'

// The districts of the town outside the campus claim.
export const TOWN_DISTRICTS = [
  'civic',
  'market',
  'entertainment',
  'residential',
  'workshop',
  'park'
] as const
export type TownDistrict = (typeof TOWN_DISTRICTS)[number]

export const ZONE_HEIGHT_CAP_M: Record<TownDistrict, number> = {
  civic: 24,
  market: 7,
  entertainment: 12,
  residential: 9,
  workshop: 12,
  park: 5
}

// The town rises outward: past the near ring a built zone may stand this many times its cap.
const FAR_RING_HEIGHT_FACTOR = 2

// The highest a lot of this zone may stand. A park stays low wherever it is: its walkers must
// be seen.
export function zoneHeightCap(zone: TownDistrict, isFarRing: boolean): number {
  const cap = ZONE_HEIGHT_CAP_M[zone]
  if (!isFarRing || zone === 'park') return cap
  return Math.min(MAX_LOT_HEIGHT_M, cap * FAR_RING_HEIGHT_FACTOR)
}

const PARK_SHARE = 0.125
// Block columns from here west are the old town; the plaza's blocks are its first column.
const PLAZA_COLUMN = -2
const AVENUE_ROWS: readonly number[] = [-1, 0]

export interface BlockCell {
  column: number
  row: number
}

// The 24 m block a 12 m lot cell lies in.
export function blockOfCell(cellColumn: number, cellRow: number): BlockCell {
  return { column: Math.floor(cellColumn / 2), row: Math.floor(cellRow / 2) }
}

// A block's zone, from its place on the paper alone: compass sectors seen from the gate.
export function zoneOfBlock(column: number, row: number): TownDistrict {
  const isOldTown = column <= PLAZA_COLUMN
  if (isOldTown && AVENUE_ROWS.includes(row)) return column === PLAZA_COLUMN ? 'civic' : 'market'
  if (draw(hashOf(`park:${column}:${row}`), 0) < PARK_SHARE) return 'park'
  if (isOldTown) return row >= 1 ? 'entertainment' : 'residential'
  return row <= -1 ? 'residential' : 'workshop'
}
