import type { FloorGeometry } from '../../scene-model'
import { box, lit, SIDES, turned, type PartSpec } from '../parts'
import { drawnTop } from '../../town/town-ambient'
import type { PlacedLot } from '../lot-kit'
import { BUILDING_SIDE_M, drum } from './buildings'
import type { RadarMount } from './lots'
import { GARRISON } from './palette'

const MAX_DISHES = 8
const DISH_TILT = 1

// A tilted dish on a yoke, with its feed horn. It turns about the pedestal it stands on.
export const DISH: PartSpec[] = [
  box([0, 0.2, 0], [0.22, 0.4, 0.22], GARRISON.steel),
  turned(drum([0, 0.5, 0], [1.3, 0.08, 1.3], GARRISON.steel), [DISH_TILT, 0, 0]),
  turned(box([0, 0.66, 0.25], [0.06, 0.5, 0.06], GARRISON.orange), [DISH_TILT, 0, 0])
]

// On every radar tower the town drew: the dish turns on top of its pedestal, the tower's peak.
export function radarMounts(placed: readonly PlacedLot[]): RadarMount[] {
  return placed
    .filter((tower) => tower.design === 'radar-tower')
    .slice(0, MAX_DISHES)
    .map((tower) => ({
      x: tower.at[0],
      y: drawnTop(tower),
      z: tower.at[2],
      scale: (tower.scale * Math.min(tower.lot.width, tower.lot.depth)) / BUILDING_SIDE_M
    }))
}

// A stub-winged shuttle, nose toward +z.
export const SHUTTLE: PartSpec[] = [
  box([0, 0, 0], [0.9, 0.5, 2.4], GARRISON.white),
  box([0, -0.04, 1.4], [0.6, 0.36, 0.5], GARRISON.steel),
  lit(box([0, 0.28, 0.6], [0.5, 0.16, 0.7], GARRISON.ice)),
  box([0, -0.1, -0.3], [3, 0.08, 0.9], GARRISON.steel),
  box([0, 0.5, -0.95], [0.08, 0.6, 0.5], GARRISON.orange),
  ...SIDES.flatMap((side) => [
    box([side * 1.5, -0.1, -0.3], [0.2, 0.1, 1], GARRISON.orange),
    box([side * 0.5, 0, -1.3], [0.36, 0.36, 0.6], GARRISON.hull)
  ])
]

// Over the runway and the north pads, under what the nearest office allows.
export const CIRCUIT_ALTITUDE_M = 6
const CIRCUIT = { nearGap: 6, turnRadius: 5, sideInset: 6 }

export function circuitLength(floor: FloorGeometry): number {
  return 4 * straightHalf(floor) + 2 * Math.PI * CIRCUIT.turnRadius
}

function straightHalf(floor: FloorGeometry): number {
  return Math.max(1, floor.width / 2 - CIRCUIT.sideInset - CIRCUIT.turnRadius)
}

// A racetrack north of the plate: east along the near straight, round, and back along the far one.
export function circuitPose(
  floor: FloorGeometry,
  share: number
): { x: number; z: number; heading: number } {
  const radius = CIRCUIT.turnRadius
  const half = straightHalf(floor)
  const centreZ = floor.z - floor.depth / 2 - CIRCUIT.nearGap - radius
  const turn = Math.PI * radius
  let travelled = share * circuitLength(floor)
  if (travelled < 2 * half)
    return { x: floor.x - half + travelled, z: centreZ + radius, heading: Math.PI / 2 }
  travelled -= 2 * half
  if (travelled < turn) {
    const angle = travelled / radius
    return {
      x: floor.x + half + radius * Math.sin(angle),
      z: centreZ + radius * Math.cos(angle),
      heading: Math.atan2(Math.cos(angle), -Math.sin(angle))
    }
  }
  travelled -= turn
  if (travelled < 2 * half)
    return { x: floor.x + half - travelled, z: centreZ - radius, heading: -Math.PI / 2 }
  const angle = (travelled - 2 * half) / radius
  return {
    x: floor.x - half - radius * Math.sin(angle),
    z: centreZ - radius * Math.cos(angle),
    heading: Math.atan2(-Math.cos(angle), Math.sin(angle))
  }
}
