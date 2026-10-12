import type { FloorGeometry } from '../../scene-model'
import { apronLots, type ApronPlan, type ApronRow } from '../apron'
import { grow, overlaps, type Rect } from '../lot-math'
import { box, lit, SIDES, type PartSpec } from '../parts'
import { GROUND_Y, type Lot } from '../surroundings'
import { GARRISON } from './palette'
import { place, type PlacedPart } from './placed'

// Where the colony and its carrier stand, west of the plate.
const DISTRICT_OFFSET_M = 5
const COLONY_M = { width: 7, depth: 22 }
const RESERVED_MARGIN_M = 0.5

const PAD_M = 6.4
const pads = (out: number, across: number, reach: ApronRow['reach']): ApronRow => ({
  kind: 'building',
  out,
  along: { min: PAD_M, max: PAD_M },
  across: { min: across, max: across },
  pitch: 8,
  reach
})
// A row of pads north and south, a column west and east that takes the corners.
const PAD_APRON: ApronPlan = {
  north: [pads(4.7, PAD_M, 'plate')],
  south: [pads(4.3, 5.6, 'plate')],
  west: [pads(6.2, PAD_M, 'apron')],
  east: [pads(6.2, PAD_M, 'apron')]
}
const RUNWAY = { gap: 11, width: 5, inset: 2, dashEvery: 6, lightEvery: 5 }
const HAZARD_LINE_GAP_M = 0.9

export function colonyStand(floor: Rect): Rect {
  return {
    x: floor.x - floor.width / 2 - DISTRICT_OFFSET_M,
    z: floor.z,
    width: COLONY_M.width,
    depth: COLONY_M.depth
  }
}

// Pads round the plate, clear of the colony as well as the shared landmarks.
export function padLots(floor: FloorGeometry): Lot[] {
  const colony = grow(colonyStand(floor), RESERVED_MARGIN_M)
  return (
    apronLots(floor, PAD_APRON)
      .filter((lot) => !overlaps(lot, colony))
      // Not the far ring: a pad beside the plate builds low, like a lot beside a company.
      .map((lot) => ({ ...lot, zoneId: 'apron' }))
  )
}

// Painted and lit ground: the runway north of the pads and a hazard line round the plate.
export function apronStrips(floor: FloorGeometry): PlacedPart[] {
  const halfWidth = floor.width / 2
  const halfDepth = floor.depth / 2
  const length = floor.width - RUNWAY.inset * 2
  const runwayZ = -halfDepth - RUNWAY.gap - RUNWAY.width / 2
  const along = (every: number): number[] =>
    Array.from(
      { length: Math.floor(length / every) },
      (_, index) => -length / 2 + (index + 0.5) * every
    )
  const lineX = halfWidth + HAZARD_LINE_GAP_M
  const lineZ = halfDepth + HAZARD_LINE_GAP_M
  const parts: PartSpec[] = [
    box([0, 0.03, runwayZ], [length, 0.06, RUNWAY.width], GARRISON.hull),
    ...along(RUNWAY.dashEvery).map((x) =>
      box([x, 0.07, runwayZ], [2.4, 0.02, 0.2], GARRISON.white)
    ),
    ...SIDES.flatMap((side) => [
      box(
        [side * (length / 2 - 0.6), 0.07, runwayZ],
        [0.5, 0.02, RUNWAY.width - 1],
        GARRISON.orange
      ),
      ...along(RUNWAY.lightEvery).map((x) =>
        lit(
          box(
            [x, 0.11, runwayZ + side * (RUNWAY.width / 2 - 0.2)],
            [0.24, 0.16, 0.24],
            GARRISON.ice
          )
        )
      ),
      box([0, 0.02, side * lineZ], [lineX * 2 + 0.16, 0.03, 0.16], GARRISON.orange),
      box([side * lineX, 0.02, 0], [0.16, 0.03, lineZ * 2 + 0.16], GARRISON.orange)
    ])
  ]
  // Drawn round the plate's own centre, wherever that lies on the floor.
  return place(parts, { x: floor.x, y: GROUND_Y, z: floor.z, scale: 1, turns: 0 })
}
