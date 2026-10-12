import { ball, box, SKIN, tube, type FigurePart } from '../../citizens/figure-parts'
import type { VehicleDesign } from '../../town/town-dress'
import { GARRISON } from './palette'

// Modelled in metres like a citizen: nose toward +z, wheels on y 0.
function wheels(radius: number, across: number, axles: readonly number[]): FigurePart[] {
  return axles.flatMap((z) =>
    [-1, 1].map((side) => ball(GARRISON.hull, radius, [side * across, radius, z]))
  )
}

export const GARRISON_VEHICLES: readonly VehicleDesign[] = [
  {
    name: 'Patrol Rover',
    role: 'transit',
    parts: () => [
      ...wheels(0.22, 0.62, [-0.8, 0, 0.8]),
      box(GARRISON.gunmetal, [1.1, 0.3, 2.4], [0, 0.45, 0]),
      box(GARRISON.white, [1, 0.5, 1.5], [0, 0.85, -0.2]),
      box(GARRISON.ice, [0.9, 0.3, 0.05], [0, 0.9, 0.56]),
      box(GARRISON.orange, [1.04, 0.1, 1.54], [0, 1.15, -0.2]),
      box(GARRISON.ice, [0.3, 0.1, 0.14], [0, 1.25, 0.2]),
      box(GARRISON.steel, [0.04, 0.4, 0.04], [0.4, 1.4, -0.8])
    ]
  },
  {
    name: 'Cargo Hauler',
    role: 'freight',
    parts: () => [
      ...wheels(0.24, 0.66, [-1.1, -0.4, 1]),
      box(GARRISON.gunmetal, [1.2, 0.24, 3], [0, 0.5, 0]),
      box(GARRISON.orange, [1.2, 0.8, 0.8], [0, 1.02, 1.05]),
      box(GARRISON.ice, [1, 0.3, 0.05], [0, 1.15, 1.47]),
      box(GARRISON.steel, [1, 0.7, 1.2], [0, 0.97, -0.75]),
      box(GARRISON.white, [0.9, 0.5, 0.7], [0, 1.57, -0.9]),
      box(GARRISON.hull, [1.24, 0.06, 0.1], [0, 0.68, -1.45])
    ]
  },
  {
    name: 'Hover Sled',
    role: 'runabout',
    parts: () => [
      // No wheels: two lift pods a hand's breadth off the deck, and the glow between them.
      ...[-1, 1].map((side) => box(GARRISON.hull, [0.3, 0.16, 1.7], [side * 0.45, 0.12, 0])),
      box(GARRISON.ice, [0.6, 0.04, 1.4], [0, 0.06, 0]),
      box(GARRISON.white, [1, 0.24, 1.9], [0, 0.34, 0]),
      box(GARRISON.orange, [0.9, 0.2, 0.5], [0, 0.56, 0.6]),
      box(GARRISON.ice, [0.8, 0.34, 0.04], [0, 0.78, 0.4]),
      box(GARRISON.navy, [0.6, 0.3, 0.5], [0, 0.61, -0.3]),
      tube(GARRISON.navy, [0.13, 0.15, 0.4], [0, 0.86, -0.25]),
      ball(SKIN, 0.11, [0, 1.16, -0.25]),
      box(GARRISON.orange, [0.06, 0.4, 0.5], [0, 0.66, -0.8])
    ]
  }
]
