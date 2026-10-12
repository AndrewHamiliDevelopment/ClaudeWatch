import type { Point } from '../../../office/sim/path'
import { SIDE_NORMAL, type WallSide } from '../logic/room-layout'
import { boundsOfZone } from '../logic/zone-framing'
import { contains, hashOf, rectOf, type Rect } from '../themes/lot-math'
import {
  CLAIM_SETBACK_M,
  LOT_PITCH_M,
  LOT_SIDE_MAX_M,
  ROAD_WIDTH_M,
  SIDEWALK_M,
  cellRect
} from './town-grid'
import { standingOn, type RoadClass } from './town-roads'
import { blockOfCell, zoneOfBlock, type TownDistrict } from './town-zones'

// A lot's place on the paper: its 12 m cell, what it fronts and where its door is.
export interface LotSite extends Rect {
  // `lot:${column}:${row}`: the same lot for as long as its cell is outside the claim.
  id: string
  seed: number
  column: number
  row: number
  zone: TownDistrict
  // `block:${column}:${row}` of the 24 m block.
  blockId: string
  facing: WallSide
  frontage: RoadClass
  // On the kerb in front of it: where a trip starts and ends.
  door: Point
}

// A strip where a citizen must be seen. A park's own lots stand inside its promenade.
export interface Promenade extends Rect {
  parkBlockId?: string
}

// The order a tie between sides is settled in.
const SIDES: readonly WallSide[] = ['north', 'east', 'south', 'west']
const CLASS_RANK: Record<RoadClass, number> = { lane: 0, collector: 1, boulevard: 2, avenue: 3 }

interface Kerbside {
  side: WallSide
  frontage: RoadClass
  // How far the lot stands back from the cell's edge on this side.
  setback: number
  fromGate: number
}

function kerbsides(cell: Rect, claim: Rect): Record<WallSide, Kerbside> {
  const beside = (side: WallSide): Kerbside => {
    const normal = SIDE_NORMAL[side]
    const middle = {
      x: cell.x + (normal.x * cell.width) / 2,
      z: cell.z + (normal.z * cell.depth) / 2
    }
    const frontage =
      normal.x === 0
        ? standingOn('z', middle.z, middle.x, claim)
        : standingOn('x', middle.x, middle.z, claim)
    return {
      side,
      frontage,
      setback: frontage === 'boulevard' ? CLAIM_SETBACK_M : ROAD_WIDTH_M[frontage] / 2,
      fromGate: Math.hypot(middle.x, middle.z)
    }
  }
  return {
    north: beside('north'),
    east: beside('east'),
    south: beside('south'),
    west: beside('west')
  }
}

// One side of a cell to the other, less what stands on each. Over 8 m, the lesser side gives way.
function span(from: number, low: Kerbside, high: Kerbside): [number, number] {
  const min = from + low.setback
  const max = from + LOT_PITCH_M - high.setback
  const over = Math.max(0, max - min - LOT_SIDE_MAX_M)
  return CLASS_RANK[low.frontage] >= CLASS_RANK[high.frontage]
    ? [min, max - over]
    : [min + over, max]
}

function siteAt(column: number, row: number, claim: Rect): LotSite {
  const cell = cellRect(column, row, LOT_PITCH_M)
  const sides = kerbsides(cell, claim)
  // The grandest road wins the front; a tie goes to the side nearer the gate.
  const [front] = SIDES.map((side) => sides[side]).sort(
    (a, b) => CLASS_RANK[b.frontage] - CLASS_RANK[a.frontage] || a.fromGate - b.fromGate
  )
  const [west, east] = span(column * LOT_PITCH_M, sides.west, sides.east)
  const [north, south] = span(row * LOT_PITCH_M, sides.north, sides.south)
  const rect = rectOf(west, east, north, south)
  const normal = SIDE_NORMAL[front.side]
  // The boulevard's kerb is past its sidewalk, inside the claim; a street's is at its own.
  const toKerb = SIDEWALK_M[front.frontage] + (front.frontage === 'boulevard' ? front.setback : 0)
  const block = blockOfCell(column, row)
  const id = `lot:${column}:${row}`
  return {
    id,
    seed: hashOf(id),
    column,
    row,
    ...rect,
    zone: zoneOfBlock(block.column, block.row),
    blockId: `block:${block.column}:${block.row}`,
    facing: front.side,
    frontage: front.frontage,
    door: {
      x: rect.x + normal.x * (rect.width / 2 + toKerb),
      z: rect.z + normal.z * (rect.depth / 2 + toKerb)
    }
  }
}

// One lot to every 12 m cell of the town outside the claim.
export function lotSites(claim: Rect, extent: Rect): LotSite[] {
  const { minX, maxX, minZ, maxZ } = boundsOfZone(extent)
  const sites: LotSite[] = []
  for (let column = minX / LOT_PITCH_M; column < maxX / LOT_PITCH_M; column++)
    for (let row = minZ / LOT_PITCH_M; row < maxZ / LOT_PITCH_M; row++)
      if (!contains(claim, cellRect(column, row, LOT_PITCH_M)))
        sites.push(siteAt(column, row, claim))
  return sites
}

// Every park block's interior: the box round its lots, with the footpaths between them.
export function parkPromenades(sites: readonly LotSite[]): Promenade[] {
  const parks = sites.filter((site) => site.zone === 'park')
  return [...new Set(parks.map((site) => site.blockId))].map((parkBlockId) => {
    const bounds = parks.filter((site) => site.blockId === parkBlockId).map(boundsOfZone)
    return {
      ...rectOf(
        Math.min(...bounds.map((each) => each.minX)),
        Math.max(...bounds.map((each) => each.maxX)),
        Math.min(...bounds.map((each) => each.minZ)),
        Math.max(...bounds.map((each) => each.maxZ))
      ),
      parkBlockId
    }
  })
}
