import type { LoungeGeometry } from '../../scene-model'
import { box, lit, SIDES, type PartSpec } from '../parts'
import { GARRISON } from './palette'

// Low enough to step past: an agent walking to the back row brushes the front row's stools.
export const STOOL_HEIGHT = 0.3
const MAT_Y = 0.012
// Furniture keeps to the strip behind the last row and to the two side walls, so the fan of
// paths from the door to the seats stays open.
const BEHIND_SEATS_M = 0.9
const SIDE_INSET_M = 0.42

function stool(x: number, z: number): PartSpec[] {
  return [
    box([x, 0.11, z], [0.14, 0.22, 0.14], GARRISON.steel),
    box([x, 0.26, z], [0.44, 0.08, 0.44], GARRISON.orange)
  ]
}

// A holo games table: a lit board on a pedestal, two pieces mid-game.
function gamesTable(x: number, z: number): PartSpec[] {
  return [
    box([x, 0.2, z], [0.5, 0.4, 0.4], GARRISON.gunmetal),
    box([x, 0.43, z], [1.5, 0.06, 0.8], GARRISON.steel),
    lit(box([x, 0.47, z], [1.3, 0.02, 0.6], GARRISON.ice)),
    box([x - 0.3, 0.53, z + 0.1], [0.12, 0.1, 0.12], GARRISON.orange),
    box([x + 0.25, 0.53, z - 0.12], [0.12, 0.1, 0.12], GARRISON.navy)
  ]
}

// A simulator pod: a dark shell on a motion base with a lit canopy and a hazard sill.
function simulatorPod(x: number, z: number): PartSpec[] {
  return [
    box([x, 0.1, z], [0.8, 0.2, 1.2], GARRISON.gunmetal),
    box([x, 0.65, z], [0.74, 0.9, 1.1], GARRISON.hull),
    lit(box([x, 0.95, z + 0.2], [0.76, 0.26, 0.6], GARRISON.ice)),
    box([x, 0.3, z], [0.78, 0.08, 1.14], GARRISON.orange),
    box([x, 1.14, z - 0.2], [0.5, 0.08, 0.5], GARRISON.steel)
  ]
}

// The mess counter: a steel galley run with a drinks dispenser at its end.
function messCounter(x: number, z: number, length: number): PartSpec[] {
  return [
    box([x, 0.38, z], [0.5, 0.76, length], GARRISON.gunmetal),
    box([x, 0.79, z], [0.56, 0.06, length + 0.06], GARRISON.steel),
    box([x, 1.05, z - length / 2 + 0.3], [0.44, 0.46, 0.44], GARRISON.hull),
    lit(box([x, 1.1, z - length / 2 + 0.53], [0.3, 0.16, 0.02], GARRISON.ice)),
    box([x, 0.86, z + length / 4], [0.3, 0.08, 0.3], GARRISON.navy)
  ]
}

// The viewport bench: a low lit sill along the back edge with a rail to lean on.
function viewport(z: number, width: number): PartSpec[] {
  return [
    box([0, 0.14, z], [width, 0.28, 0.16], GARRISON.hull),
    lit(box([0, 0.31, z], [width - 0.3, 0.06, 0.1], GARRISON.ice)),
    ...SIDES.map((side) =>
      box([side * (width / 2 - 0.1), 0.5, z], [0.08, 0.44, 0.08], GARRISON.steel)
    ),
    box([0, 0.72, z], [width, 0.05, 0.08], GARRISON.steel)
  ]
}

// The garrison's mess deck, in the lounge's own coordinates (its centre on the floor is 0, 0).
export function loungeParts(lounge: LoungeGeometry): PartSpec[] {
  const seats = lounge.seats.map((seat) => ({ x: seat.x - lounge.x, z: seat.z - lounge.z }))
  const halfDepth = lounge.depth / 2
  const sideX = lounge.width / 2 - SIDE_INSET_M
  const behind = Math.max(...seats.map((seat) => seat.z), -halfDepth) + BEHIND_SEATS_M
  const tableZ = Math.min(behind + 0.4, halfDepth - 0.9)
  return [
    box([0, MAT_Y, 0], [lounge.width - 0.3, 0.02, lounge.depth - 0.3], GARRISON.gunmetal),
    box([0, MAT_Y + 0.004, -halfDepth + 0.26], [1.1, 0.02, 0.22], GARRISON.orange),
    ...seats.flatMap((seat) => stool(seat.x, seat.z)),
    ...gamesTable(0, tableZ),
    ...simulatorPod(sideX, halfDepth - 0.95),
    ...messCounter(-sideX, halfDepth - 1.3, 1.9),
    ...viewport(halfDepth - 0.12, lounge.width - 2.6)
  ]
}
