import type { WallSide } from '../../logic/room-layout'
import type { FloorGeometry, ZoneGeometry } from '../../scene-model'
import { box, type PartSpec } from '../parts'
import { GROUND_Y, MAX_LOT_HEIGHT_M, WORLD_APRON, type Lot } from '../surroundings'
import { share } from './lot-kit'

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>

export interface ApronLot extends Lot {
  side: WallSide
  // Counted out from the plate: row 0 is the one against it.
  row: number
}

const APRON_CELL_M = 5.5
const APRON_GAP_M = 1
const APRON_LOT_M = { min: 4, max: 4.9 }
const APRON_SIDES: readonly WallSide[] = ['west', 'east', 'north', 'south']
const MIN_APRON_ROOM_M = 1
// As surroundings.ts: a thing of height h hides 1.43 h of ground at the camera's elevation.
const HEIGHT_PER_METRE = 0.7

// Where WorldView stands the tower, and where both themes stand their hangar.
export function towerStand(floor: FloorGeometry): Rect {
  return { x: floor.width / 2 + 7, z: -floor.depth / 2 - 8, width: 8, depth: 8 }
}
export function hangarStand(floor: FloorGeometry): Rect {
  return { x: floor.width / 2 + 5.5, z: 0, width: 6, depth: 7.4 }
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2
  )
}

function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2)
  const dz = Math.max(0, Math.abs(a.z - b.z) - (a.depth + b.depth) / 2)
  return Math.hypot(dx, dz)
}

function officesOf(floor: FloorGeometry): Rect[] {
  const flatten = (zones: readonly ZoneGeometry[]): ZoneGeometry[] =>
    zones.flatMap((zone) => [zone, ...flatten(zone.children)])
  const projects = flatten(floor.zones).filter((zone) => zone.kind === 'project')
  if (projects.length > 0) return projects
  if (floor.rooms.length > 0) return floor.rooms
  return [{ x: 0, z: 0, width: floor.width, depth: floor.depth }]
}

// The band on one side of the plate; the west and east bands take the corners.
function bandOf(side: WallSide, floor: FloorGeometry) {
  const isAlongX = side === 'north' || side === 'south'
  const start = isAlongX ? -floor.width / 2 : -floor.depth / 2 - WORLD_APRON.north
  const end = isAlongX ? floor.width / 2 : floor.depth / 2 + WORLD_APRON.south
  const rows = Math.floor((WORLD_APRON[side] - APRON_GAP_M) / APRON_CELL_M)
  const columns = Math.floor((end - start) / APRON_CELL_M)
  const edge = (isAlongX ? floor.depth : floor.width) / 2
  const outward = side === 'north' || side === 'west' ? -1 : 1
  return { isAlongX, start, step: (end - start) / columns, rows, columns, edge, outward }
}

const TERRACE_THICKNESS_M = 0.08

// The paving under one side's band, laid on the ground plane.
export function apronTerrace(floor: FloorGeometry, side: WallSide, color: string): PartSpec {
  const band = bandOf(side, floor)
  const reach = WORLD_APRON[side]
  const length = band.columns * band.step
  const out = band.outward * (band.edge + reach / 2)
  const along = band.start + length / 2
  const y = GROUND_Y + TERRACE_THICKNESS_M / 2
  return box(
    band.isAlongX ? [along, y, out] : [out, y, along],
    band.isAlongX ? [length, TERRACE_THICKNESS_M, reach] : [reach, TERRACE_THICKNESS_M, length],
    color
  )
}

// Lots on the apron the floor theme's district and hangar fill, low by the plate and taller out.
export function apronLots(floor: FloorGeometry): ApronLot[] {
  const offices = officesOf(floor)
  const stands = [towerStand(floor), hangarStand(floor)]
  const lots: ApronLot[] = []
  APRON_SIDES.forEach((side, sideIndex) => {
    const band = bandOf(side, floor)
    for (let row = 0; row < band.rows; row++) {
      for (let column = 0; column < band.columns; column++) {
        const seed =
          (Math.imul(sideIndex + 1, 0x9e3779b1) ^
            Math.imul(row + 1, 0x85ebca6b) ^
            Math.imul(column + 1, 0xc2b2ae35)) >>>
          0
        const out = band.edge + APRON_GAP_M + (row + 0.5) * APRON_CELL_M
        const along = band.start + (column + 0.5) * band.step
        const rect: Rect = {
          x: band.isAlongX ? along : band.outward * out,
          z: band.isAlongX ? band.outward * out : along,
          width: APRON_LOT_M.min + (APRON_LOT_M.max - APRON_LOT_M.min) * share(seed, 0),
          depth: APRON_LOT_M.min + (APRON_LOT_M.max - APRON_LOT_M.min) * share(seed, 1)
        }
        if (stands.some((stand) => overlaps(rect, stand))) continue
        const nearest = Math.min(...offices.map((office) => gapBetween(rect, office)))
        const maxHeight = Math.min(MAX_LOT_HEIGHT_M, nearest * HEIGHT_PER_METRE)
        if (maxHeight - GROUND_Y < MIN_APRON_ROOM_M) continue
        lots.push({
          id: `apron:${side}:${row}:${column}`,
          kind: 'building',
          ...rect,
          maxHeight,
          seed,
          zoneId: null,
          side,
          row
        })
      }
    }
  })
  return lots
}
