import { gapBetween, overlaps, type Rect, type Span } from '../themes/lot-math'
import {
  OPPOSITE_PAIRS,
  RUN_END_CLEAR_M,
  onSide,
  runsOf,
  spanAlong,
  type Ground,
  type Side
} from './belt-frame'
import { gardenPiece, levelled, roomOver, type GreenPlot } from './garden-pieces'
import { ROAD_WIDTH_M } from './town-grid'

// Full-size trees on the campus side of the lawn, 6 m apart and half a pitch off the walk row's
// trees, so the two rows read as an allee. The deepest line both opposite sides have room for.
const AVENUE_PITCH_M = 6
const AVENUE_DEPTHS_M = [18.5, 16]
const AVENUE_TREE_M = { along: 2.4, across: 1.6 }
const AVENUE_PLATE_CLEAR_M = 1
// Kerb-high edging on both long sides of the lawn: by the walk, and behind the avenue.
const OUTER_HEDGE_DEPTH_M = ROAD_WIDTH_M.boulevard + 1.5
const INNER_HEDGE_BEHIND_M = AVENUE_TREE_M.across / 2 + 0.6
const HEDGE_ACROSS_M = 0.3
const HEDGE_PLATE_CLEAR_M = 0.2
const BLOCKER_MARGIN_M = 0.5
const MIN_HEDGE_M = 1
// The inner lines stop short of each claim corner, where two sides' lines would cross.
const CORNER_KEEP_OUT_M = AVENUE_DEPTHS_M[0] + INNER_HEDGE_BEHIND_M + 1

function cornerKeepOuts({ claim }: Ground): Rect[] {
  const side = CORNER_KEEP_OUT_M * 2
  return [claim.minX, claim.maxX].flatMap((x) =>
    [claim.minZ, claim.maxZ].map((z) => ({ x, z, width: side, depth: side }))
  )
}

function isClear(rect: Rect, ground: Ground, plateClear: number): boolean {
  const { plate } = ground.site
  return (
    !overlaps(rect, plate) &&
    !overlaps(rect, ground.street) &&
    gapBetween(rect, plate) >= plateClear
  )
}

// What a line across a run must step round, mirrored about the run's middle so the run stays
// its own mirror when a corner stands at one end only.
function blockedSpans(side: Side, run: Span, line: Rect, blockers: readonly Rect[]): Span[] {
  const middle = (run.min + run.max) / 2
  return blockers
    .filter((blocker) => overlaps(line, blocker))
    .flatMap((blocker) => {
      const { min, max } = spanAlong(side, blocker)
      return [
        { min: min - BLOCKER_MARGIN_M, max: max + BLOCKER_MARGIN_M },
        { min: 2 * middle - max - BLOCKER_MARGIN_M, max: 2 * middle - min + BLOCKER_MARGIN_M }
      ]
    })
}

const isFree = (span: Span, blocked: readonly Span[]): boolean =>
  blocked.every((each) => span.max <= each.min || span.min >= each.max)

// The run less its blocked stretches, as continuous lengths.
function segmentsOf(run: Span, blocked: readonly Span[]): Span[] {
  const cuts = [...blocked].sort((a, b) => a.min - b.min)
  const segments: Span[] = []
  let from = run.min + RUN_END_CLEAR_M
  for (const cut of cuts) {
    if (cut.min > from)
      segments.push({ min: from, max: Math.min(cut.min, run.max - RUN_END_CLEAR_M) })
    from = Math.max(from, cut.max)
  }
  segments.push({ min: from, max: run.max - RUN_END_CLEAR_M })
  return segments.filter((segment) => segment.max - segment.min >= MIN_HEDGE_M)
}

function hedgesOn(
  ground: Ground,
  side: Side,
  run: Span,
  runIndex: number,
  depth: number,
  blockers: readonly Rect[]
): GreenPlot[] {
  const name = depth === OUTER_HEDGE_DEPTH_M ? 'outer' : 'inner'
  const middle = (run.min + run.max) / 2
  const line = onSide(ground.claim, side, middle, depth, {
    along: run.max - run.min,
    across: HEDGE_ACROSS_M
  })
  return segmentsOf(run, blockedSpans(side, run, line, blockers)).map((segment, index) => {
    const rect = onSide(ground.claim, side, (segment.min + segment.max) / 2, depth, {
      along: segment.max - segment.min,
      across: HEDGE_ACROSS_M
    })
    return gardenPiece(`garden:${side}:hedge:${name}:${runIndex}:${index}`, 'hedge', rect, {
      facing: side,
      zoneId: ground.zoneIdOf(side),
      maxHeight: roomOver(rect, ground.site, ground.promenades)
    })
  })
}

function treesOn(
  ground: Ground,
  side: Side,
  run: Span,
  runIndex: number,
  depth: number,
  blockers: readonly Rect[]
): GreenPlot[] {
  const middle = (run.min + run.max) / 2
  const reach = (run.max - run.min) / 2 - RUN_END_CLEAR_M - AVENUE_TREE_M.along / 2
  const last = Math.floor(reach / AVENUE_PITCH_M)
  const line = onSide(ground.claim, side, middle, depth, {
    along: run.max - run.min,
    across: AVENUE_TREE_M.across
  })
  const blocked = blockedSpans(side, run, line, blockers)
  return Array.from({ length: Math.max(0, last * 2 + 1) }, (_, index) => index - last).flatMap(
    (slot) => {
      const along = middle + slot * AVENUE_PITCH_M
      const rect = onSide(ground.claim, side, along, depth, AVENUE_TREE_M)
      if (!isFree(spanAlong(side, rect), blocked)) return []
      const id = `garden:${side}:innerTree:${runIndex}:${slot}`
      return [
        gardenPiece(id, 'innerTree', rect, {
          facing: side,
          zoneId: ground.zoneIdOf(side),
          maxHeight: roomOver(rect, ground.site, ground.promenades)
        })
      ]
    }
  )
}

// Does a whole line at `depth` across every run of a side stand clear?
function lineFits(ground: Ground, side: Side, depth: number, across: number, clear: number) {
  return runsOf(side, ground.claim).every((run) => {
    const along = run.max - run.min
    const line = onSide(ground.claim, side, (run.min + run.max) / 2, depth, { along, across })
    return isClear(line, ground, clear)
  })
}

// The inner avenue and both edgings, for each pair of opposite sides that has room for them.
// `standing` are the features and corners the avenue and the inner edging step round.
export function avenuesOf(ground: Ground, standing: readonly Rect[]): GreenPlot[] {
  const blockers = [...standing, ...cornerKeepOuts(ground)]
  return OPPOSITE_PAIRS.flatMap((pair) => {
    const sides: readonly Side[] = pair
    const fits = (depth: number, across: number, clear: number): boolean =>
      sides.every((side) => lineFits(ground, side, depth, across, clear))
    const depth = AVENUE_DEPTHS_M.find((each) =>
      fits(each, AVENUE_TREE_M.across, AVENUE_PLATE_CLEAR_M)
    )
    const innerHedge = depth === undefined ? undefined : depth + INNER_HEDGE_BEHIND_M
    const hasInnerHedge =
      innerHedge !== undefined && fits(innerHedge, HEDGE_ACROSS_M, HEDGE_PLATE_CLEAR_M)
    const placed = sides.map((side) =>
      runsOf(side, ground.claim).flatMap((run, runIndex) => [
        ...hedgesOn(ground, side, run, runIndex, OUTER_HEDGE_DEPTH_M, []),
        ...(depth === undefined ? [] : treesOn(ground, side, run, runIndex, depth, blockers)),
        ...(hasInnerHedge && innerHedge !== undefined
          ? hedgesOn(ground, side, run, runIndex, innerHedge, blockers)
          : [])
      ])
    )
    const all = placed.flat()
    const trees = levelled(all.filter((piece) => piece.role === 'innerTree'))
    return [...all.filter((piece) => piece.role !== 'innerTree'), ...trees]
  })
}
