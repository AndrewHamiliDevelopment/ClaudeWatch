import { box, lit, SIDES, type PartSpec } from '../parts'
import { drum, type YardDesign } from './buildings'
import { GARRISON } from './palette'

// A prop lies along a company's wall: this long, this far out, feet at y 0.
export const PROP_FOOTPRINT_M = { length: 1.6, reach: 0.8 }

// A cargo container on its corner posts, sometimes with a smaller one stacked on it.
function container(limit: number, share: number): PartSpec[] {
  const isStacked = share > 0.5 && limit >= 1.3
  return [
    box([0, 0.4, 0], [1.5, 0.72, 0.7], share > 0.25 ? GARRISON.orange : GARRISON.steel),
    ...SIDES.map((side) => box([side * 0.76, 0.4, 0], [0.06, 0.8, 0.76], GARRISON.hull)),
    box([0, 0.77, 0], [1.56, 0.04, 0.76], GARRISON.hull),
    ...(isStacked ? [box([-0.2, 1.04, 0], [1, 0.5, 0.6], GARRISON.white)] : [])
  ]
}

// A bar of three landing lights on short stalks.
function landingLights(): PartSpec[] {
  return [
    box([0, 0.04, 0], [1.5, 0.08, 0.3], GARRISON.hull),
    ...[-0.6, 0, 0.6].flatMap((x) => [
      box([x, 0.24, 0], [0.08, 0.32, 0.08], GARRISON.steel),
      lit(box([x, 0.45, 0], [0.2, 0.1, 0.2], GARRISON.ice))
    ])
  ]
}

// A whip aerial on a weighted foot, with its radio set beside it.
function antennaMast(limit: number, share: number): PartSpec[] {
  const height = Math.min(limit, 1.8 + share * 1.2)
  return [
    box([-0.3, 0.1, 0], [0.5, 0.2, 0.5], GARRISON.hull),
    box([-0.3, height / 2, 0], [0.07, height - 0.2, 0.07], GARRISON.steel),
    box([-0.3, height * 0.7, 0], [0.6, 0.05, 0.05], GARRISON.white),
    box([-0.3, height * 0.85, 0], [0.4, 0.05, 0.05], GARRISON.white),
    lit(box([-0.3, height - 0.06, 0], [0.12, 0.12, 0.12], GARRISON.ice)),
    box([0.45, 0.3, 0], [0.5, 0.6, 0.4], GARRISON.gunmetal),
    box([0.45, 0.62, 0], [0.54, 0.04, 0.44], GARRISON.orange)
  ]
}

// A deck loader: a low hazard-orange tractor with a cab and a lifting fork.
function loader(): PartSpec[] {
  return [
    ...SIDES.flatMap((side) =>
      SIDES.map((along) =>
        box([along * 0.34 - 0.15, 0.13, side * 0.31], [0.28, 0.26, 0.12], GARRISON.hull)
      )
    ),
    box([-0.15, 0.36, 0], [1.1, 0.3, 0.5], GARRISON.orange),
    box([-0.42, 0.7, 0], [0.42, 0.4, 0.46], GARRISON.white),
    lit(box([-0.2, 0.74, 0], [0.02, 0.2, 0.36], GARRISON.ice)),
    box([0.44, 0.55, 0], [0.06, 0.9, 0.5], GARRISON.steel),
    ...SIDES.map((side) => box([0.62, 0.16, side * 0.16], [0.34, 0.05, 0.08], GARRISON.steel))
  ]
}

// Three blast barriers in a row, each with a hazard band.
function barrier(): PartSpec[] {
  return [-0.52, 0, 0.52].flatMap((x) => [
    box([x, 0.05, 0], [0.5, 0.1, 0.5], GARRISON.hull),
    box([x, 0.33, 0], [0.46, 0.46, 0.26], GARRISON.white),
    box([x, 0.42, 0], [0.48, 0.1, 0.28], GARRISON.orange)
  ])
}

// A floodlight on a pole, fed by the generator at its foot.
function floodlight(limit: number, share: number): PartSpec[] {
  const pole = Math.min(limit - 0.35, 1.5 + share * 0.9)
  return [
    box([-0.35, 0.07, 0], [0.5, 0.14, 0.5], GARRISON.hull),
    box([-0.35, pole / 2, 0], [0.09, pole, 0.09], GARRISON.steel),
    box([-0.35, pole + 0.15, 0], [0.7, 0.3, 0.18], GARRISON.hull),
    lit(box([-0.35, pole + 0.15, 0.1], [0.6, 0.2, 0.02], GARRISON.ice)),
    box([0.42, 0.25, 0], [0.6, 0.4, 0.44], GARRISON.orange),
    box([0.42, 0.5, 0], [0.4, 0.1, 0.3], GARRISON.gunmetal)
  ]
}

// Three fuel drums on a pallet.
function fuelDrums(): PartSpec[] {
  return [
    box([0, 0.04, 0], [1.6, 0.08, 0.7], GARRISON.hull),
    ...[-0.52, 0, 0.52].flatMap((x) => [
      drum([x, 0.43, 0], [0.48, 0.7, 0.48], GARRISON.white),
      drum([x, 0.8, 0], [0.34, 0.04, 0.34], GARRISON.steel)
    ])
  ]
}

// A stack of supply crates, strapped.
function crateStack(): PartSpec[] {
  return [
    box([-0.4, 0.27, 0], [0.7, 0.54, 0.7], GARRISON.steel),
    box([0.42, 0.21, 0], [0.62, 0.42, 0.62], GARRISON.gunmetal),
    box([-0.4, 0.71, 0], [0.46, 0.34, 0.46], GARRISON.white),
    box([-0.4, 0.28, 0], [0.12, 0.56, 0.72], GARRISON.orange),
    box([0.42, 0.21, 0], [0.64, 0.08, 0.64], GARRISON.orange)
  ]
}

export const PROPS: readonly YardDesign[] = [
  { id: 'container', minHeight: 0.9, build: container },
  { id: 'landing-lights', minHeight: 0.5, build: landingLights },
  { id: 'antenna-mast', minHeight: 1.2, build: antennaMast },
  { id: 'loader', minHeight: 1, build: loader },
  { id: 'barrier', minHeight: 0.6, build: barrier },
  { id: 'floodlight', minHeight: 1.4, build: floodlight },
  { id: 'fuel-drums', minHeight: 0.9, build: fuelDrums },
  { id: 'crate-stack', minHeight: 0.9, build: crateStack }
]
