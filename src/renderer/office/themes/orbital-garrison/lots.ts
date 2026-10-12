import type { FloorGeometry } from '../../scene-model'
import { GROUND_Y, type Lot } from '../surroundings'
import {
  BUILDING_SIDE_M,
  BUILDINGS,
  RADAR_PEDESTAL_M,
  radarDeckHeight,
  type YardDesign
} from './buildings'
import { place, roll, type PlacedPart } from './placed'
import { PROP_FOOTPRINT_M, PROPS } from './yard-props'

// Lots beside a company stay low so the offices lead; only the far ring builds to its limit.
const NEAR_LIMIT_M = { min: 5, spread: 7 }

export interface RadarMount {
  x: number
  y: number
  z: number
  scale: number
}

interface LotBuild {
  designId: string
  parts: PlacedPart[]
  // Where a dish turns, on a lot that drew a radar tower.
  mount: RadarMount | null
}

// The slab's top inside the plate, the open ground outside it.
export function baseYOf(lot: Pick<Lot, 'x' | 'z' | 'width' | 'depth'>, floor: FloorGeometry) {
  const isOnPlate =
    Math.abs(lot.x) + lot.width / 2 <= floor.width / 2 &&
    Math.abs(lot.z) + lot.depth / 2 <= floor.depth / 2
  return isOnPlate ? 0 : GROUND_Y
}

function pick(designs: readonly YardDesign[], limit: number, share: number): YardDesign {
  const allowed = designs.filter((design) => design.minHeight <= limit)
  return allowed[Math.floor(share * allowed.length)] ?? designs[0]
}

// Everything is chosen from the lot's seed, so the world is the same on every start.
export function buildLot(lot: Lot, baseY: number): LotBuild {
  const isProp = lot.kind === 'prop'
  const isSideways = isProp && lot.depth > lot.width
  const scale = isProp
    ? Math.min(
        Math.max(lot.width, lot.depth) / PROP_FOOTPRINT_M.length,
        Math.min(lot.width, lot.depth) / PROP_FOOTPRINT_M.reach
      )
    : Math.min(lot.width, lot.depth) / BUILDING_SIDE_M
  const room = (lot.maxHeight - baseY) / scale
  const limit =
    isProp || lot.zoneId === null
      ? room
      : Math.min(room, NEAR_LIMIT_M.min + roll(lot.seed, 5) * NEAR_LIMIT_M.spread)
  const design = pick(isProp ? PROPS : BUILDINGS, limit, roll(lot.seed, 6))
  const share = roll(lot.seed, 7)
  const turns = isProp
    ? (isSideways ? 1 : 0) + (roll(lot.seed, 8) < 0.5 ? 0 : 2)
    : Math.floor(roll(lot.seed, 8) * 4)
  return {
    designId: design.id,
    parts: place(design.build(limit, share), { x: lot.x, y: baseY, z: lot.z, scale, turns }),
    mount:
      design.id === 'radar-tower'
        ? {
            x: lot.x,
            y: baseY + (radarDeckHeight(limit, share) + RADAR_PEDESTAL_M) * scale,
            z: lot.z,
            scale
          }
        : null
  }
}
