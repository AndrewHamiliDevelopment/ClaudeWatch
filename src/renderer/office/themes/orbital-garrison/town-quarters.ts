import type { ZoneDesign } from '../../town/town-dress'
import { box, cylinder, lit, SIDES } from '../parts'
import { GARRISON } from './palette'
import { BAYS } from './town-halls'

type Build = ZoneDesign['build']

const POD_PITCH_M = 1.6
const POD_HEIGHT_M = 1.4

// Habitat pods: two stacks of round cabins, each with a lit porthole band, on a stair spine.
export const habitatPods: Build = ({ width, depth, height, accent }) => {
  const levels = Math.max(1, Math.floor((height - 0.3) / POD_PITCH_M))
  const pod = Math.min(width / 2 - 0.5, depth - 0.8)
  const top = (levels - 1) * POD_PITCH_M + 0.1 + POD_HEIGHT_M
  return [
    ...SIDES.flatMap((side) => {
      const x = side * (pod / 2 + 0.15)
      return [
        ...Array.from({ length: levels }, (_, level) => [
          cylinder(
            [x, level * POD_PITCH_M + 0.1 + POD_HEIGHT_M / 2, 0],
            [pod, POD_HEIGHT_M, pod],
            GARRISON.gunmetal
          ),
          lit(
            cylinder(
              [x, level * POD_PITCH_M + 0.9, 0],
              [pod + 0.04, 0.24, pod + 0.04],
              GARRISON.ice
            )
          )
        ]).flat(),
        cylinder([x, top + 0.07, 0], [pod * 0.92, 0.14, pod * 0.92], accent)
      ]
    }),
    box([0, top / 2, -pod * 0.3], [0.5, top, 0.6], GARRISON.hull),
    box([0, 0.55, pod * 0.42], [0.6, 1.1, 0.2], GARRISON.orange)
  ]
}

// Officers' row: three small houses side by side, each under its own two-step roof.
export const officersRow: Build = ({ width, depth, height, accent }) => {
  const wall = height * 0.6
  const house = (width * 0.9) / BAYS.length
  const front = depth * 0.2
  return BAYS.flatMap((nth) => {
    const x = nth * house
    return [
      box([x, wall / 2, -depth * 0.08], [house - 0.3, wall, depth * 0.56], GARRISON.steel),
      box(
        [x, wall + height * 0.07, -depth * 0.08],
        [house - 0.14, height * 0.14, depth * 0.62],
        accent
      ),
      box(
        [x, wall + height * 0.19, -depth * 0.08],
        [(house - 0.3) * 0.5, height * 0.1, depth * 0.3],
        accent
      ),
      box([x + house * 0.2, height * 0.84, -depth * 0.2], [0.2, height * 0.28, 0.2], GARRISON.hull),
      lit(
        box(
          [x - house * 0.15, wall * 0.55, front + 0.02],
          [house * 0.25, wall * 0.3, 0.04],
          GARRISON.ice
        )
      ),
      box(
        [x + house * 0.18, wall * 0.35, front + 0.03],
        [house * 0.2, wall * 0.7, 0.06],
        GARRISON.navy
      )
    ]
  })
}

// The fleet hangar: one great hall under a stepped vault, its door the width of a frame bay.
export const fleetHangar: Build = ({ width, depth, height, accent }) => {
  const wall = height * 0.6
  const front = depth * 0.36
  return [
    box([0, wall / 2, -depth * 0.04], [width * 0.9, wall, depth * 0.8], GARRISON.gunmetal),
    box(
      [0, wall + height * 0.06, -depth * 0.04],
      [width * 0.94, height * 0.12, depth * 0.84],
      accent
    ),
    box(
      [0, wall + height * 0.17, -depth * 0.04],
      [width * 0.7, height * 0.1, depth * 0.84],
      accent
    ),
    box(
      [0, wall + height * 0.26, -depth * 0.04],
      [width * 0.42, height * 0.08, depth * 0.84],
      GARRISON.white
    ),
    box([0, wall * 0.42, front + 0.03], [width * 0.62, wall * 0.84, 0.06], GARRISON.hull),
    box([0, wall * 0.88, front + 0.04], [width * 0.66, wall * 0.08, 0.08], GARRISON.orange),
    lit(box([0, wall * 0.95, front + 0.03], [width * 0.3, wall * 0.04, 0.06], GARRISON.ice)),
    ...SIDES.map((side) =>
      box(
        [side * width * 0.455, wall / 2, -depth * 0.04],
        [0.14, wall, depth * 0.82],
        GARRISON.steel
      )
    ),
    box(
      [width * 0.3, height * 0.95 - 0.12, -depth * 0.3],
      [0.14, height * 0.1, 0.14],
      GARRISON.white
    ),
    lit(box([width * 0.3, height - 0.12, -depth * 0.3], [0.26, 0.24, 0.26], GARRISON.ice))
  ]
}

// Hydroponic beds: three planted trays under a grow-light gantry.
export const hydroponicBed: Build = ({ width, depth, height, accent }) => {
  const lamp = height - 0.15
  return [
    ...BAYS.flatMap((nth) => [
      box([0, 0.2, nth * depth * 0.28], [width * 0.8, 0.4, depth * 0.18], GARRISON.gunmetal),
      box([0, 0.52, nth * depth * 0.28], [width * 0.74, 0.24, depth * 0.13], accent)
    ]),
    ...SIDES.map((side) =>
      box([side * width * 0.44, lamp / 2, 0], [0.12, lamp, 0.12], GARRISON.steel)
    ),
    lit(box([0, lamp + 0.05, 0], [width * 0.9, 0.1, 0.14], GARRISON.ice)),
    box([width * 0.42, 0.3, 0], [0.1, 0.1, depth * 0.74], GARRISON.white)
  ]
}

// A parade lawn: marching lines, a reviewing stand at the back and the colours on a flagstaff.
export const paradeLawn: Build = ({ width, depth, height, accent }) => [
  box([0, 0.05, 0], [width * 0.92, 0.1, depth * 0.92], accent),
  ...SIDES.map((side) =>
    box([side * width * 0.3, 0.11, 0], [0.16, 0.02, depth * 0.8], GARRISON.white)
  ),
  box([0, 0.35, -depth * 0.36], [width * 0.4, 0.5, depth * 0.14], GARRISON.gunmetal),
  box([0, 0.65, -depth * 0.36], [width * 0.44, 0.1, depth * 0.18], GARRISON.white),
  box([width * 0.3, height / 2, -depth * 0.3], [0.1, height, 0.1], GARRISON.steel),
  box([width * 0.3 + 0.4, height - 0.35, -depth * 0.3], [0.7, 0.45, 0.04], GARRISON.orange),
  ...SIDES.map((side) =>
    box([side * width * 0.42, 0.25, depth * 0.4], [0.2, 0.5, 0.2], GARRISON.hull)
  )
]
