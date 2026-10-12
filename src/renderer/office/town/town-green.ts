import { boundsOfZone, type Bounds } from '../logic/zone-framing'
import type { FloorGeometry } from '../scene-model'
import { gapBetween, overlaps, type Rect, type Span } from '../themes/lot-math'
import { MIN_LOT_HEIGHT_M, surveySite, type Site } from '../themes/surroundings'
import {
  ROW_ACROSS_M,
  ROW_DEPTH_M,
  gardenPiece,
  levelled,
  roomOver,
  type GreenPlot
} from './garden-pieces'
import type { GardenRole } from './town-dress'
import { MIN_BELT_M, ROAD_WIDTH_M } from './town-grid'
import { nearestCompany, type TownPlan } from './town-plan'
import { plazaPieces } from './town-plaza'

export type { GreenPlot } from './garden-pieces'

type Side = 'north' | 'south' | 'west' | 'east'
const SIDES: readonly Side[] = ['north', 'south', 'west', 'east']

// Trees every two slots, lamps every four between them, seats in the gaps the lamps leave.
// A wide campus spaces its slots out by whole steps: the garden is the prop share of
// LOT_CAP (80), less the plaza, the corners and up to six features.
const SLOT_STEP_M = 3
const ROW_PIECE_CAP = 80 - 16 - 4 - 6
const ROW_ALONG_M = 1.6
const RUN_END_CLEAR_M = 1
// The plaza's half-depth: the west side leaves it to the plaza, the east side matches.
const GATE_BAND_M = ROAD_WIDTH_M.avenue
// Features and corners stand behind the row, where only the plate can take their room.
const DEEP_FROM_M = MIN_BELT_M + 0.4
const FEATURE_M = { along: 8, across: 4 }
const CORNER_M = 4
const PLATE_CLEAR_M = 1

const isAlongX = (side: Side): boolean => side === 'north' || side === 'south'

// A rectangle `depth` in from the claim edge of `side`, centred at `along` on it.
function onSide(
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
function runsOf(side: Side, claim: Bounds): Span[] {
  if (isAlongX(side)) return [{ min: claim.minX + MIN_BELT_M, max: claim.maxX - MIN_BELT_M }]
  const runs = [
    { min: claim.minZ + MIN_BELT_M, max: -GATE_BAND_M },
    { min: GATE_BAND_M, max: claim.maxZ - MIN_BELT_M }
  ]
  return runs.filter((run) => run.max > run.min)
}

// Centred on a seat: trees at odd slots, lamps and seats taking turns at the even ones.
function roleAt(slot: number): GardenRole {
  const away = Math.abs(slot)
  if (away % 2 === 1) return 'tree'
  return (away / 2) % 2 === 1 ? 'lamp' : 'seat'
}

interface Ground {
  claim: Bounds
  site: Site
  // The avenue's width carried through the claim, from the plaza past the gate.
  street: Rect
  promenades: readonly Rect[]
  zoneIdOf: (side: Side) => string | null
}

function rowOf(
  ground: Ground,
  side: Side,
  run: Span,
  runIndex: number,
  slotM: number
): GreenPlot[] {
  const middle = (run.min + run.max) / 2
  const reach = (run.max - run.min) / 2 - RUN_END_CLEAR_M - ROW_ALONG_M / 2
  const last = Math.floor(reach / slotM)
  return Array.from({ length: Math.max(0, last * 2 + 1) }, (_, index) => {
    const slot = index - last
    const role = roleAt(slot)
    const rect = onSide(ground.claim, side, middle + slot * slotM, ROW_DEPTH_M, {
      along: ROW_ALONG_M,
      across: ROW_ACROSS_M
    })
    return gardenPiece(`garden:${side}:${role}:${runIndex}:${slot}`, role, rect, {
      facing: side,
      zoneId: ground.zoneIdOf(side),
      maxHeight: roomOver(rect, ground.site, ground.promenades)
    })
  })
}

// Clear of the plate and the campus street, and tall enough for a design to stand.
function hasRoom(piece: GreenPlot, { site, street }: Ground): boolean {
  return (
    !overlaps(piece, site.plate) &&
    !overlaps(piece, street) &&
    gapBetween(piece, site.plate) >= PLATE_CLEAR_M &&
    piece.maxHeight >= MIN_LOT_HEIGHT_M.building
  )
}

// All four or none, so every side stays its own mirror.
function cornersOf(ground: Ground): GreenPlot[] {
  const { claim } = ground
  const depth = DEEP_FROM_M + CORNER_M / 2
  const corners = (['north', 'south'] as const).flatMap((side) =>
    [claim.minX + depth, claim.maxX - depth].map((x) => {
      const rect = onSide(claim, side, x, depth, { along: CORNER_M, across: CORNER_M })
      return gardenPiece(`garden:${side}:corner:${x}`, 'corner', rect, {
        facing: side,
        zoneId: null,
        maxHeight: roomOver(rect, ground.site, ground.promenades)
      })
    })
  )
  return levelled(corners)
}

// One per run, centred on it; opposite runs keep theirs only together.
function featuresOf(ground: Ground, corners: readonly Rect[]): GreenPlot[] {
  const depth = DEEP_FROM_M + FEATURE_M.across / 2
  const featureOf = (side: Side, run: Span, runIndex: number): GreenPlot | null => {
    if (run.max - run.min < FEATURE_M.along + RUN_END_CLEAR_M * 2) return null
    const rect = onSide(ground.claim, side, (run.min + run.max) / 2, depth, FEATURE_M)
    const piece = gardenPiece(`garden:${side}:feature:${runIndex}`, 'feature', rect, {
      facing: side,
      zoneId: ground.zoneIdOf(side),
      maxHeight: roomOver(rect, ground.site, ground.promenades)
    })
    const isClear = hasRoom(piece, ground) && !corners.some((corner) => overlaps(piece, corner))
    return isClear ? piece : null
  }
  const pairs: readonly (readonly [Side, Side])[] = [
    ['north', 'south'],
    ['west', 'east']
  ]
  return pairs.flatMap(([one, other]) =>
    runsOf(one, ground.claim).flatMap((run, runIndex) => {
      const pair = [featureOf(one, run, runIndex), featureOf(other, run, runIndex)]
      return pair[0] && pair[1] ? levelled([pair[0], pair[1]]) : []
    })
  )
}

// The campus garden, laid out from the claim: a row of trees, lamps and seats along the walk
// on every side, a feature centred on each run and a piece at each corner, then the plaza.
// Only the features and corners depend on the plate, and they go before they would move.
export function campusGreen(floor: FloorGeometry, plan: TownPlan): GreenPlot[] {
  const site = surveySite(floor)
  const claim = boundsOfZone(plan.claim)
  const middleOf = (side: Side): Rect =>
    onSide(claim, side, isAlongX(side) ? plan.claim.x : plan.claim.z, ROW_DEPTH_M, {
      along: ROW_ALONG_M,
      across: ROW_ACROSS_M
    })
  const ground: Ground = {
    claim,
    site,
    street: { ...plan.claim, z: 0, depth: ROAD_WIDTH_M.avenue },
    promenades: plan.promenades,
    zoneIdOf: (side) => nearestCompany(middleOf(side), site.companies)?.id ?? null
  }
  const rowsAt = (slotM: number): GreenPlot[] =>
    SIDES.flatMap((side) =>
      runsOf(side, claim).flatMap((run, runIndex) => rowOf(ground, side, run, runIndex, slotM))
    )
  let slotM = SLOT_STEP_M
  while (rowsAt(slotM).length > ROW_PIECE_CAP) slotM += SLOT_STEP_M
  const rows = rowsAt(slotM)
  // Features keep off the corners' places whether or not the corners have room.
  const corners = cornersOf(ground)
  const hasCorners = corners.every((corner) => hasRoom(corner, ground))
  return [
    ...levelled(rows),
    ...featuresOf(ground, corners),
    ...(hasCorners ? corners : []),
    ...plazaPieces(plan.claim, site, plan.promenades)
  ]
}
