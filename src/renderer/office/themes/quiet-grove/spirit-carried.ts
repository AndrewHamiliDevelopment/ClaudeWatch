import { box, cone, cylinder, lit, sphere, turned, SIDES } from '../parts'
import type { Vector } from '../primitives'
import type { CarriedFeature, GroveCharacter, Kin } from './kin'
import { GROVE } from './palette'
import { ON_ITS_SIDE, type SpiritParts } from './spirit-features'

// Where each kin's shoulders and back are, in the model's own metres.
const CARRY: Record<Kin, { shoulder: number; back: number }> = {
  keeper: { shoulder: 0.64, back: -0.14 },
  helper: { shoulder: 0.46, back: -0.2 },
  wanderer: { shoulder: 0.58, back: -0.17 }
}
const FACING_FRONT: Vector = [Math.PI / 2, 0, 0]

// Loads any kin can carry. Each rises above the shoulders or sits wider than the body, so it
// reads from the front and from above.
export const CARRIED_PARTS: Record<CarriedFeature, (who: GroveCharacter) => Partial<SpiritParts>> =
  {
    'walking-staff': ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      const height = shoulder + 0.42
      return {
        body: [
          cylinder([-0.3, height / 2, back + 0.06], [0.03, height, 0.03], GROVE.bark),
          sphere([-0.3, height + 0.02, back + 0.06], [0.08, 0.08, 0.08], GROVE.bark),
          sphere([-0.24, shoulder + 0.3, back + 0.06], [0.1, 0.12, 0.1], GROVE.paper)
        ]
      }
    },
    'frame-pack': ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      return {
        body: [
          box([0, shoulder - 0.08, back - 0.07], [0.3, 0.38, 0.14], GROVE.bark),
          turned(
            cylinder([0, shoulder + 0.17, back - 0.07], [0.15, 0.46, 0.15], GROVE.paper),
            ON_ITS_SIDE
          ),
          sphere([0.19, shoulder - 0.18, back - 0.07], [0.11, 0.11, 0.11], GROVE.stone)
        ]
      }
    },
    basket: ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      return {
        body: [
          cylinder([0, shoulder - 0.12, back - 0.09], [0.34, 0.34, 0.28], GROVE.timber),
          cylinder([0, shoulder + 0.06, back - 0.09], [0.37, 0.03, 0.31], GROVE.bark),
          sphere([-0.06, shoulder + 0.09, back - 0.09], [0.13, 0.1, 0.13], GROVE.clay),
          sphere([0.07, shoulder + 0.08, back - 0.08], [0.11, 0.09, 0.11], GROVE.fern)
        ]
      }
    },
    yoke: ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      return {
        body: [
          turned(cylinder([0, shoulder + 0.05, back], [0.03, 0.74, 0.03], GROVE.bark), ON_ITS_SIDE),
          ...SIDES.flatMap((side) => [
            cylinder([side * 0.35, shoulder - 0.07, back], [0.012, 0.22, 0.012], GROVE.paper),
            cylinder([side * 0.35, shoulder - 0.24, back], [0.14, 0.13, 0.14], GROVE.bark)
          ])
        ]
      }
    },
    'reed-bundle': ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      return {
        body: [
          ...[-1, 0, 1].map((lean) =>
            turned(cylinder([lean * 0.09, shoulder + 0.08, back], [0.03, 0.8, 0.03], GROVE.fern), [
              0,
              0,
              -lean * 0.28
            ])
          ),
          box([0, shoulder - 0.1, back], [0.2, 0.05, 0.05], GROVE.paper)
        ]
      }
    },
    kite: ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      return {
        body: [
          cylinder([0.27, shoulder + 0.12, back], [0.02, 0.7, 0.02], GROVE.bark),
          turned(box([0.27, shoulder + 0.55, back], [0.22, 0.22, 0.015], GROVE.clay), [
            0,
            0,
            Math.PI / 4
          ]),
          box([0.27, shoulder + 0.36, back], [0.05, 0.05, 0.01], GROVE.paper)
        ]
      }
    },
    bell: ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      const height = shoulder + 0.5
      return {
        body: [
          cylinder([-0.28, height / 2, back], [0.03, height, 0.03], GROVE.bark),
          turned(
            cylinder([-0.2, height - 0.02, back], [0.025, 0.2, 0.025], GROVE.bark),
            ON_ITS_SIDE
          ),
          cone([-0.13, height - 0.12, back], [0.15, 0.16, 0.15], GROVE.timber),
          sphere([-0.13, height - 0.21, back], [0.05, 0.05, 0.05], GROVE.paper)
        ]
      }
    },
    ladder: ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      return {
        body: [
          ...SIDES.map((side) =>
            cylinder([side * 0.11, shoulder + 0.02, back - 0.03], [0.025, 1, 0.025], GROVE.timber)
          ),
          ...[-0.3, -0.08, 0.14, 0.36].map((rise) =>
            box([0, shoulder + rise, back - 0.03], [0.22, 0.025, 0.025], GROVE.timber)
          )
        ]
      }
    },
    torch: ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      return {
        body: [
          cylinder([0.27, shoulder + 0.02, back], [0.03, 0.72, 0.03], GROVE.bark),
          cylinder([0.27, shoulder + 0.35, back], [0.09, 0.04, 0.09], GROVE.bark),
          lit(sphere([0.27, shoulder + 0.44, back], [0.12, 0.17, 0.12], GROVE.lumen))
        ]
      }
    },
    net: ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      return {
        body: [
          turned(
            cylinder([0.05, shoulder + 0.1, back], [0.025, 0.8, 0.025], GROVE.bark),
            [0, 0, -0.45]
          ),
          turned(
            cylinder([0.27, shoulder + 0.55, back], [0.26, 0.02, 0.26], GROVE.paper),
            FACING_FRONT
          )
        ]
      }
    },
    'seed-sack': ({ kin }) => {
      const { shoulder, back } = CARRY[kin]
      return {
        body: [
          sphere([0, shoulder - 0.02, back - 0.08], [0.44, 0.4, 0.3], GROVE.timber),
          cylinder([0, shoulder + 0.2, back - 0.08], [0.1, 0.08, 0.1], GROVE.paper)
        ]
      }
    }
  }
