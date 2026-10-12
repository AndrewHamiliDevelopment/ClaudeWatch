import type { Bounds } from '../logic/zone-framing'
import { gapBetween, overlaps, type Rect, type Span } from '../themes/lot-math'
import type { Site } from '../themes/surroundings'
import { MIN_BELT_M, ROAD_WIDTH_M } from './town-grid'

// The garden belt's frame: four sides, measured along each and in from its claim edge.
export type Side = 'north' | 'south' | 'west' | 'east'
export const SIDES: readonly Side[] = ['north', 'south', 'west', 'east']
// Each pair keeps its avenue, features and edging only together, so opposite sides match.
export const OPPOSITE_PAIRS: readonly (readonly [Side, Side])[] = [
  ['north', 'south'],
  ['west', 'east']
]

export const RUN_END_CLEAR_M = 1
// The plaza's half-depth: the west side leaves it to the plaza, the east side matches.
const GATE_BAND_M = ROAD_WIDTH_M.avenue

export interface Ground {
  claim: Bounds
  site: Site
  // The avenue's width carried through the claim, from the plaza past the gate.
  street: Rect
  promenades: readonly Rect[]
  zoneIdOf: (side: Side) => string | null
}

export const isAlongX = (side: Side): boolean => side === 'north' || side === 'south'

// A rectangle `depth` in from the claim edge of `side`, centred at `along` on it.
export function onSide(
  claim: Bounds,
  side: Side,
  along: number,
  depth: number,
  size: { along: number; across: number }
): Rect {
  const inward = {
    north: claim.minZ + depth,
    south: claim.maxZ - depth,
    west: claim.minX + depth,
    east: claim.maxX - depth
  }[side]
  return isAlongX(side)
    ? { x: along, z: inward, width: size.along, depth: size.across }
    : { x: inward, z: along, width: size.across, depth: size.along }
}

// Between the corners; west and east are cut by the gate band into two runs.
export function runsOf(side: Side, claim: Bounds): Span[] {
  if (isAlongX(side)) return [{ min: claim.minX + MIN_BELT_M, max: claim.maxX - MIN_BELT_M }]
  const runs = [
    { min: claim.minZ + MIN_BELT_M, max: -GATE_BAND_M },
    { min: GATE_BAND_M, max: claim.maxZ - MIN_BELT_M }
  ]
  return runs.filter((run) => run.max > run.min)
}

// Slot numbers centred on a run's middle, as many each way as `pitch` fits short of its ends.
export function centredSlots(run: Span, along: number, pitch: number): number[] {
  const reach = (run.max - run.min) / 2 - RUN_END_CLEAR_M - along / 2
  const last = Math.floor(reach / pitch)
  return Array.from({ length: Math.max(0, last * 2 + 1) }, (_, index) => index - last)
}

// Off the plate and the campus street, with at least `clear` metres to the plate.
export function isClearOfPlate(rect: Rect, { site, street }: Ground, clear: number): boolean {
  return (
    !overlaps(rect, site.plate) && !overlaps(rect, street) && gapBetween(rect, site.plate) >= clear
  )
}

// Where a rectangle lies along a side.
export function spanAlong(side: Side, rect: Rect): Span {
  const [middle, length] = isAlongX(side) ? [rect.x, rect.width] : [rect.z, rect.depth]
  return { min: middle - length / 2, max: middle + length / 2 }
}
