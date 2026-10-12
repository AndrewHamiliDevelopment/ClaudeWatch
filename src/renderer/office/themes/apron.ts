import type { FloorGeometry } from '../scene-model'
import { GROUND_Y, WORLD_APRON, type Lot } from './surroundings'

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>
type Plate = Pick<FloorGeometry, 'width' | 'depth'>

// The paved band the floor theme lays around the plate, and where its lots stand.
export const APRON_PAVING = { y: GROUND_Y + 0.15, thickness: 0.2 }
export const APRON_TOP_Y = APRON_PAVING.y + APRON_PAVING.thickness / 2

// surroundings.ts keeps every lot under this slope; the apron's lots obey the same rule.
const HEIGHT_PER_METRE = 0.7
const MAX_HEIGHT_M = 24
export const HANGAR = { offsetX: 5.5, width: 6, depth: 7 }
export const TOWER = { offsetX: 7, offsetZ: 8, side: 7 }
export const GATE = { offsetZ: 5, avenue: 5 }

// A row of lots beside the plate: how far out it starts and how large its lots are.
interface Row {
  kind: Lot['kind']
  gap: number
  along: number
  across: number
  pitch: number
}
type Side = 'north' | 'south' | 'west' | 'east'

const GARDEN: Row = { kind: 'prop', gap: 1.6, along: 1.8, across: 1, pitch: 3.6 }
const ROWS: Record<Side, readonly Row[]> = {
  north: [
    GARDEN,
    { kind: 'building', gap: 4.2, along: 5.5, across: 5.5, pitch: 7 },
    { kind: 'building', gap: 11.2, along: 6.5, across: 7, pitch: 8 }
  ],
  south: [GARDEN, { kind: 'building', gap: 3.6, along: 5.5, across: 4, pitch: 7 }],
  west: [GARDEN, { kind: 'building', gap: 4.2, along: 5.5, across: 6.5, pitch: 7 }],
  east: [GARDEN, { kind: 'building', gap: 4.2, along: 5.5, across: 6.5, pitch: 7 }]
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2
  )
}

function gapToPlate(rect: Rect, floor: Plate): number {
  const dx = Math.max(0, Math.abs(rect.x) - rect.width / 2 - floor.width / 2)
  const dz = Math.max(0, Math.abs(rect.z) - rect.depth / 2 - floor.depth / 2)
  return Math.hypot(dx, dz)
}

// Where the floor theme's hangar, tower and gate avenue stand: no apron lot goes there.
export function apronReserved(floor: Plate): Rect[] {
  const east = floor.width / 2
  return [
    { x: east + HANGAR.offsetX, z: 0, width: HANGAR.width + 0.6, depth: HANGAR.depth + 0.6 },
    {
      x: east + TOWER.offsetX,
      z: -floor.depth / 2 - TOWER.offsetZ,
      width: TOWER.side,
      depth: TOWER.side
    },
    {
      x: 0,
      z: floor.depth / 2 + WORLD_APRON.south / 2,
      width: GATE.avenue,
      depth: WORLD_APRON.south
    }
  ]
}

// Centres of a row's lots, evenly spread from `from` to `to`.
function spread(from: number, to: number, pitch: number): number[] {
  const count = Math.max(1, Math.floor((to - from) / pitch))
  const step = (to - from) / count
  return Array.from({ length: count }, (_, index) => from + (index + 0.5) * step)
}

function lotsBeside(side: Side, floor: Plate): Lot[] {
  const isAlongX = side === 'north' || side === 'south'
  const sign = side === 'north' || side === 'west' ? -1 : 1
  const edge = isAlongX ? floor.depth / 2 : floor.width / 2
  // North and south rows run on through the corners; west and east rows fill between them.
  const reach = isAlongX ? floor.width / 2 + WORLD_APRON.west : floor.depth / 2
  // The south rows stop either side of the gate's avenue instead of losing lots to it.
  const spans =
    side === 'south'
      ? [
          [-reach, -GATE.avenue / 2],
          [GATE.avenue / 2, reach]
        ]
      : [[-reach, reach]]
  return ROWS[side].flatMap((row, rowIndex) =>
    spans
      .flatMap(([from, to]) => spread(from, to, row.pitch))
      .map((along, index): Lot => {
        const out = sign * (edge + row.gap + row.across / 2)
        const rect: Rect = isAlongX
          ? { x: along, z: out, width: row.along, depth: row.across }
          : { x: out, z: along, width: row.across, depth: row.along }
        return {
          id: `apron:${side}:${rowIndex}:${index}`,
          kind: row.kind,
          ...rect,
          maxHeight: Math.min(MAX_HEIGHT_M, gapToPlate(rect, floor) * HEIGHT_PER_METRE),
          seed:
            (Math.imul(index + 1 + rowIndex * 131, 0x9e3779b1) ^ (side.charCodeAt(0) << 16)) >>> 0,
          zoneId: null
        }
      })
  )
}

// The floor theme's own lots on the apron, so the band between the plate and the ring is filled.
export function apronLots(floor: Plate): Lot[] {
  const reserved = apronReserved(floor)
  return (['north', 'south', 'west', 'east'] as const)
    .flatMap((side) => lotsBeside(side, floor))
    .filter((lot) => !reserved.some((landmark) => overlaps(lot, landmark)))
}
