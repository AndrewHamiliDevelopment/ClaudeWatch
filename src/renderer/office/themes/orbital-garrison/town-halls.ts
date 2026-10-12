import type { ZoneDesign } from '../../town/town-dress'
import { box, cylinder, lit, SIDES, sphere } from '../parts'
import { GARRISON } from './palette'

// Every build stands on y 0 inside its plot, front toward +z, and roofs itself in `plot.accent`.
type Build = ZoneDesign['build']

export const BAYS = [-1, 0, 1] as const

// A low command post by the plaza: one room, a window band and a beacon mast.
export const dutyOffice: Build = ({ width, depth, height, accent }) => {
  const wall = height - 0.5
  const front = depth * 0.175
  return [
    box([0, wall / 2, -depth * 0.1], [width * 0.7, wall, depth * 0.55], GARRISON.gunmetal),
    box([0, wall + 0.1, -depth * 0.1], [width * 0.76, 0.2, depth * 0.62], accent),
    lit(box([0, wall * 0.62, front + 0.02], [width * 0.4, wall * 0.22, 0.04], GARRISON.ice)),
    box([width * 0.27, wall * 0.3, front + 0.03], [0.7, wall * 0.6, 0.06], GARRISON.orange),
    box([-width * 0.3, height / 2 - 0.1, -depth * 0.3], [0.1, height - 0.2, 0.1], GARRISON.steel),
    lit(box([-width * 0.3, height - 0.1, -depth * 0.3], [0.2, 0.2, 0.2], GARRISON.ice))
  ]
}

// Three shop bays under one parapet, with an awning out over the pavement.
export const commissaryRow: Build = ({ width, depth, height, accent }) => {
  const wall = height - 0.4
  const bay = (width * 0.9) / BAYS.length
  const front = depth * 0.13
  return [
    ...BAYS.flatMap((nth) => [
      box(
        [nth * bay, wall / 2, -depth * 0.12],
        [bay - 0.12, wall, depth * 0.5],
        nth === 0 ? GARRISON.steel : GARRISON.gunmetal
      ),
      lit(box([nth * bay, wall * 0.45, front + 0.02], [bay * 0.6, wall * 0.4, 0.04], GARRISON.ice))
    ]),
    box([0, wall + 0.08, -depth * 0.12], [width * 0.92, 0.16, depth * 0.54], GARRISON.white),
    box([0, wall * 0.82, depth * 0.27], [width * 0.92, 0.1, depth * 0.3], accent),
    box([0, wall + 0.28, depth * 0.1], [width * 0.5, 0.24, 0.1], GARRISON.orange)
  ]
}

// A stores building: a roller door, a serving hatch under a canopy and plant on the roof.
export const supplyDepot: Build = ({ width, depth, height, accent }) => {
  const wall = height - 0.6
  const front = depth * 0.2
  return [
    box([0, wall / 2, -depth * 0.1], [width * 0.8, wall, depth * 0.6], GARRISON.gunmetal),
    box([0, wall + 0.1, -depth * 0.1], [width * 0.84, 0.2, depth * 0.64], accent),
    box(
      [-width * 0.15, wall * 0.35, front + 0.03],
      [width * 0.36, wall * 0.7, 0.06],
      GARRISON.hull
    ),
    box([-width * 0.15, wall * 0.74, front + 0.04], [width * 0.4, 0.14, 0.08], GARRISON.orange),
    lit(
      box([width * 0.22, wall * 0.5, front + 0.02], [width * 0.2, wall * 0.25, 0.04], GARRISON.ice)
    ),
    box([width * 0.22, wall * 0.72, depth * 0.3], [width * 0.3, 0.08, depth * 0.2], accent),
    box([width * 0.2, wall + 0.4, -depth * 0.2], [width * 0.2, 0.4, depth * 0.2], GARRISON.steel),
    box([-width * 0.3, 0.3, depth * 0.36], [0.9, 0.6, 0.9], GARRISON.orange)
  ]
}

// The garrison's canteen: a drum with a lit gallery under one great dome and a beacon spire.
export const canteenDome: Build = ({ width, depth, height, accent }) => {
  const across = Math.min(width, depth) * 0.86
  const drum = height * 0.4
  const domeTop = drum + 0.1 + height * 0.38
  return [
    cylinder([0, drum / 2, 0], [across, drum, across], GARRISON.gunmetal),
    lit(cylinder([0, drum * 0.6, 0], [across + 0.06, drum * 0.16, across + 0.06], GARRISON.ice)),
    cylinder([0, drum + 0.08, 0], [across + 0.1, 0.16, across + 0.1], GARRISON.steel),
    // The dome's lower half is inside the drum, and still clear of the ground.
    sphere([0, drum + 0.1, 0], [across * 0.94, height * 0.76, across * 0.94], accent),
    box([0, drum * 0.35, across / 2 - 0.1], [across * 0.3, drum * 0.7, 0.3], GARRISON.hull),
    box([0, drum * 0.74, across / 2 - 0.08], [across * 0.36, 0.12, 0.34], GARRISON.orange),
    cylinder([0, (domeTop + height) / 2 - 0.1, 0], [0.16, height - domeTop, 0.16], GARRISON.white),
    lit(sphere([0, height - 0.15, 0], [0.3, 0.3, 0.3], GARRISON.ice))
  ]
}

// An open arena: four emitter pylons round a pad, and the light they throw up between them.
export const holoArena: Build = ({ width, depth, height, accent }) => {
  const across = Math.min(width, depth) * 0.8
  const post = height - 0.2
  const corner = (across / 2 - 0.2) * 0.7
  const glow = Math.min(across * 0.4, height * 0.5)
  return [
    cylinder([0, 0.1, 0], [across, 0.2, across], GARRISON.hull),
    cylinder([0, 0.24, 0], [across * 0.7, 0.08, across * 0.7], GARRISON.gunmetal),
    lit(cylinder([0, 0.3, 0], [across * 0.5, 0.04, across * 0.5], GARRISON.ice)),
    lit(sphere([0, 0.4 + glow / 2, 0], [glow, glow, glow], GARRISON.ice)),
    ...SIDES.flatMap((xSide) =>
      SIDES.flatMap((zSide) => [
        box([xSide * corner, post / 2, zSide * corner], [0.24, post, 0.24], GARRISON.steel),
        box([xSide * corner, post + 0.1, zSide * corner], [0.5, 0.2, 0.5], accent)
      ])
    ),
    box([0, 0.45, -across * 0.42], [across * 0.5, 0.5, 0.3], GARRISON.gunmetal)
  ]
}

// A recreation hall: a tall room under a stepped roof with a clerestory, a marquee on the door.
export const recHall: Build = ({ width, depth, height, accent }) => {
  const wall = height * 0.7
  const front = depth * 0.3
  return [
    box([0, wall / 2, -depth * 0.05], [width * 0.8, wall, depth * 0.7], GARRISON.gunmetal),
    box(
      [0, wall + height * 0.05, -depth * 0.05],
      [width * 0.84, height * 0.1, depth * 0.74],
      accent
    ),
    lit(
      box(
        [0, wall + height * 0.14, -depth * 0.05],
        [width * 0.5, height * 0.08, depth * 0.4],
        GARRISON.ice
      )
    ),
    box(
      [0, wall + height * 0.22, -depth * 0.05],
      [width * 0.56, height * 0.08, depth * 0.46],
      GARRISON.white
    ),
    box([0, wall * 0.3, front + 0.03], [width * 0.3, wall * 0.6, 0.06], GARRISON.hull),
    box([0, wall * 0.68, depth * 0.38], [width * 0.4, 0.12, depth * 0.16], GARRISON.orange),
    ...SIDES.map((side) =>
      lit(
        box(
          [side * width * 0.28, wall * 0.55, front + 0.02],
          [width * 0.12, wall * 0.3, 0.04],
          GARRISON.ice
        )
      )
    )
  ]
}
