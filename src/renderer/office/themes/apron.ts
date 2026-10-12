import type { WallSide } from '../logic/room-layout'
import type { FloorGeometry } from '../scene-model'
import { between, overlaps, type Rect, type Span } from './lot-math'
import {
  apronOf,
  draw,
  hashOf,
  heightLimit,
  MIN_LOT_HEIGHT_M,
  officesOf,
  WORLD_APRON,
  type Lot
} from './surroundings'

export interface ApronLot extends Lot {
  side: WallSide
  // Counted out from the plate: row 0 is the one against it.
  row: number
}

// A row of lots beside the plate. Each theme lays its own rows; the placer is the same.
export interface ApronRow {
  kind: Lot['kind']
  // From the plate's edge to the row's centre line.
  out: number
  along: Span
  across: Span
  pitch: number
  // Whether the row runs on through the apron's corners or stops at the plate's ends.
  reach: 'plate' | 'apron'
}
export type ApronPlan = Record<WallSide, readonly ApronRow[]>

const HANGAR_OFFSET_M = 5.5
const TOWER_OFFSET_M = { east: 7, north: 8 }
export const GATE = { offsetZ: 5, avenue: 5 }
const APRON_SIDES: readonly WallSide[] = ['north', 'south', 'west', 'east']

// Where every theme stands its hangar, and where the scene stands the tower.
export function hangarStand(floor: Rect): Rect {
  return { x: floor.x + floor.width / 2 + HANGAR_OFFSET_M, z: floor.z, width: 6.6, depth: 8 }
}
export function towerStand(floor: Rect): Rect {
  return {
    x: floor.x + floor.width / 2 + TOWER_OFFSET_M.east,
    z: floor.z - floor.depth / 2 - TOWER_OFFSET_M.north,
    width: 8,
    depth: 8
  }
}

// The hangar, the tower and the avenue to the south gate: no apron lot goes there.
export function apronStands(floor: Rect): Rect[] {
  const avenue: Rect = {
    x: floor.x,
    z: floor.z + floor.depth / 2 + WORLD_APRON.south / 2,
    width: GATE.avenue,
    depth: WORLD_APRON.south
  }
  return [hangarStand(floor), towerStand(floor), avenue]
}

// Centres of a row's lots, evenly spread from `from` to `to`.
function centres(from: number, to: number, pitch: number): number[] {
  const count = Math.max(1, Math.floor((to - from) / pitch))
  const step = (to - from) / count
  return Array.from({ length: count }, (_, index) => from + (index + 0.5) * step)
}

function rowLots(
  side: WallSide,
  rowIndex: number,
  row: ApronRow,
  floor: Rect,
  offices: readonly Rect[]
): ApronLot[] {
  const isAlongX = side === 'north' || side === 'south'
  const outward = side === 'north' || side === 'west' ? -1 : 1
  const span = row.reach === 'apron' ? apronOf(floor) : floor
  const [middle, half] = isAlongX ? [span.x, span.width / 2] : [span.z, span.depth / 2]
  // The south rows stop either side of the gate's avenue instead of losing lots to it.
  const stretches =
    side === 'south'
      ? [
          [middle - half, floor.x - GATE.avenue / 2],
          [floor.x + GATE.avenue / 2, middle + half]
        ]
      : [[middle - half, middle + half]]
  const edge = isAlongX
    ? floor.z + (outward * floor.depth) / 2
    : floor.x + (outward * floor.width) / 2
  const out = edge + outward * row.out
  return stretches
    .flatMap(([from, to]) => centres(from, to, row.pitch))
    .flatMap((along, index): ApronLot[] => {
      const id = `apron:${side}:${rowIndex}:${index}`
      const seed = hashOf(id)
      const length = between(row.along, draw(seed, 0))
      const reach = between(row.across, draw(seed, 1))
      const rect: Rect = isAlongX
        ? { x: along, z: out, width: length, depth: reach }
        : { x: out, z: along, width: reach, depth: length }
      const maxHeight = heightLimit(rect, offices)
      if (maxHeight < MIN_LOT_HEIGHT_M[row.kind]) return []
      return [{ id, kind: row.kind, ...rect, maxHeight, seed, zoneId: null, side, row: rowIndex }]
    })
}

// The floor theme's lots on the apron, clear of the landmarks. Each is limited by its real
// distance to the nearest office, so nothing on it hides a desk at any map rotation.
export function apronLots(floor: FloorGeometry, plan: ApronPlan): ApronLot[] {
  const offices = officesOf(floor)
  const stands = apronStands(floor)
  return APRON_SIDES.flatMap((side) =>
    plan[side].flatMap((row, rowIndex) => rowLots(side, rowIndex, row, floor, offices))
  ).filter((lot) => !stands.some((stand) => overlaps(lot, stand)))
}

// One side's band of the apron; the west and east bands take the corners.
export function apronBand(floor: Rect, side: WallSide): Rect {
  const apron = apronOf(floor)
  const reach = WORLD_APRON[side]
  const outward = side === 'north' || side === 'west' ? -1 : 1
  return side === 'north' || side === 'south'
    ? {
        x: floor.x,
        z: floor.z + outward * (floor.depth / 2 + reach / 2),
        width: floor.width,
        depth: reach
      }
    : {
        x: floor.x + outward * (floor.width / 2 + reach / 2),
        z: apron.z,
        width: reach,
        depth: apron.depth
      }
}
