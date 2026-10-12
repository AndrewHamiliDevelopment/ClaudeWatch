import type { FloorGeometry } from '../../scene-model'
import { box, lit, SIDES, type PartSpec } from '../parts'
import { GROUND_Y, WORLD_APRON, type Lot } from '../surroundings'
import { GARRISON } from './palette'
import { place, seedOf, type PlacedPart } from './placed'

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>

// Where the district, the hangar and the tower stand beside the plate.
export const DISTRICT_OFFSET_M = 5
export const HANGAR_OFFSET_M = 5.5
const TOWER_OFFSET_M = { east: 7, north: 8 }

const PAD_M = 6.4
const PAD_PITCH_M = 8
const SOUTH_PAD_DEPTH_M = 5.6
const PLATE_GAP_M = 1.5
const COLUMN_GAP_M = 3
const RESERVED_MARGIN_M = 0.5
// Offices stand at least this far inside the plate, behind their company's fence.
const OFFICE_INSET_M = 5
const HEIGHT_PER_METRE = 0.7
const RUNWAY = { gap: 11, width: 5, inset: 2, dashEvery: 6, lightEvery: 5 }
const HAZARD_LINE_GAP_M = 0.9

// The colony and its carrier, the frame hangar and the floor tower: no pad may stand on them.
export function apronReserved(floor: FloorGeometry): Rect[] {
  const east = floor.width / 2
  return [
    { x: -east - DISTRICT_OFFSET_M, z: 0, width: 7, depth: 22 },
    { x: east + HANGAR_OFFSET_M, z: 0, width: 5, depth: 7 },
    {
      x: east + TOWER_OFFSET_M.east,
      z: -floor.depth / 2 - TOWER_OFFSET_M.north,
      width: 6,
      depth: 6
    }
  ]
}

function spread(from: number, to: number): number[] {
  const count = Math.max(1, Math.floor((to - from) / PAD_PITCH_M) + 1)
  return Array.from({ length: count }, (_, index) =>
    count === 1 ? (from + to) / 2 : from + ((to - from) * index) / (count - 1)
  )
}

function isClear(rect: Rect, reserved: readonly Rect[]): boolean {
  return reserved.every(
    (kept) =>
      Math.abs(rect.x - kept.x) >= (rect.width + kept.width) / 2 + RESERVED_MARGIN_M ||
      Math.abs(rect.z - kept.z) >= (rect.depth + kept.depth) / 2 + RESERVED_MARGIN_M
  )
}

// Pads round the plate, drawn like any lot: a row north and south, a column west and east.
// Sized from the plate alone, so the district is rebuilt only when the floor changes size.
export function apronLots(floor: FloorGeometry): Lot[] {
  const halfWidth = floor.width / 2
  const halfDepth = floor.depth / 2
  const reserved = apronReserved(floor)
  const rowXs = spread(-halfWidth + PAD_M / 2, halfWidth - PAD_M / 2)
  const columnZs = spread(
    -halfDepth - WORLD_APRON.north + PAD_M / 2,
    halfDepth + WORLD_APRON.south - PAD_M / 2
  )
  const columnX = halfWidth + COLUMN_GAP_M + PAD_M / 2
  const sites: [string, Rect, number][] = [
    ...rowXs.map((x, index): [string, Rect, number] => [
      `north:${index}`,
      { x, z: -halfDepth - PLATE_GAP_M - PAD_M / 2, width: PAD_M, depth: PAD_M },
      PLATE_GAP_M
    ]),
    ...rowXs.map((x, index): [string, Rect, number] => [
      `south:${index}`,
      {
        x,
        z: halfDepth + PLATE_GAP_M + SOUTH_PAD_DEPTH_M / 2,
        width: PAD_M,
        depth: SOUTH_PAD_DEPTH_M
      },
      PLATE_GAP_M
    ]),
    ...SIDES.flatMap((side) =>
      columnZs.map((z, index): [string, Rect, number] => [
        `${side < 0 ? 'west' : 'east'}:${index}`,
        { x: side * columnX, z, width: PAD_M, depth: PAD_M },
        COLUMN_GAP_M
      ])
    )
  ]
  return sites
    .filter(([, rect]) => isClear(rect, reserved))
    .map(([name, rect, plateGap]) => ({
      id: `apron:${name}`,
      kind: 'building',
      ...rect,
      maxHeight: (plateGap + OFFICE_INSET_M) * HEIGHT_PER_METRE,
      seed: seedOf(`apron:${name}`),
      // Not the far ring: a pad beside the plate builds low, like a lot beside a company.
      zoneId: 'apron'
    }))
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
  return place(parts, { x: 0, y: GROUND_Y, z: 0, scale: 1, turns: 0 })
}
