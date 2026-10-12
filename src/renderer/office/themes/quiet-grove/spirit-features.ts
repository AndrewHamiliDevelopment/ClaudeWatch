import type { Vector } from '../primitives'
import { box, cone, cylinder, sphere, turned, type PartSpec, lit, SIDES } from '../parts'
import type { GroveCharacter, SpiritFeature } from './kin'
import { GROVE } from './palette'

export type SpiritJoint = 'base' | 'legs' | 'body' | 'leftArm' | 'rightArm' | 'head' | 'gear'
export type SpiritParts = Record<SpiritJoint, PartSpec[]>

export const ON_ITS_SIDE: Vector = [0, 0, Math.PI / 2]
const KEEPER_BACK = -0.14
const HELPER_BACK = -0.2

// What each feature adds, and to which joint. Head pieces are head-local; a keeper's and a
// wanderer's head top out at 0.24 and a helper's at 0.26. Hats stay narrow and sit back, so the face shows from above. Back pieces sit wide so they still read from the front.
export const FEATURE_PARTS: Record<SpiritFeature, (who: GroveCharacter) => Partial<SpiritParts>> = {
  'straw-hat': () => ({ head: [cone([0, 0.3, -0.05], [0.44, 0.2, 0.44], GROVE.timber)] }),
  'bark-cap': () => ({
    head: [
      cylinder([0, 0.24, -0.03], [0.3, 0.07, 0.28], GROVE.bark),
      box([0, 0.215, 0.13], [0.22, 0.02, 0.1], GROVE.bark)
    ]
  }),
  'leaf-crown': () => ({
    head: [-1, 0, 1].map((lean) =>
      turned(
        cone([lean * 0.1, 0.31 - Math.abs(lean) * 0.03, -0.03], [0.1, 0.2, 0.05], GROVE.fern),
        [0, 0, -lean * 0.5]
      )
    )
  }),
  'top-knot': () => ({
    head: [
      cylinder([0, 0.22, -0.02], [0.23, 0.06, 0.22], GROVE.bark),
      sphere([0, 0.3, -0.03], [0.14, 0.14, 0.14], GROVE.bark),
      box([0, 0.31, -0.03], [0.26, 0.02, 0.02], GROVE.paper)
    ]
  }),
  'pine-hood': () => ({ head: [cone([0, 0.33, -0.06], [0.3, 0.3, 0.28], GROVE.pine)] }),
  'reed-tuft': () => ({
    head: [-1, 0, 1].map((lean) =>
      turned(
        cylinder([lean * 0.05, 0.335 - Math.abs(lean) * 0.02, 0], [0.025, 0.2, 0.025], GROVE.fern),
        [0, 0, -lean * 0.25]
      )
    )
  }),
  'cap-shade': () => ({ head: [sphere([0, 0.27, -0.05], [0.44, 0.18, 0.4], GROVE.pond)] }),
  'lily-pad': () => ({
    head: [
      cylinder([0, 0.27, -0.05], [0.42, 0.03, 0.4], GROVE.fern),
      sphere([0.07, 0.32, -0.03], [0.1, 0.1, 0.1], GROVE.paper)
    ]
  }),
  'twin-leaves': () => ({
    head: SIDES.map((side) =>
      turned(cone([side * 0.09, 0.33, -0.02], [0.1, 0.22, 0.04], GROVE.fern), [0, 0, -side * 0.7])
    )
  }),
  'pebble-crest': () => ({
    head: [
      sphere([0, 0.28, -0.02], [0.19, 0.1, 0.17], GROVE.moss),
      sphere([0, 0.35, -0.02], [0.12, 0.08, 0.11], GROVE.paper)
    ]
  }),
  'lantern-staff': () => ({
    body: [
      cylinder([-0.22, 0.6, KEEPER_BACK], [0.025, 1.1, 0.025], GROVE.bark),
      lit(sphere([-0.22, 1.2, KEEPER_BACK], [0.13, 0.16, 0.13], GROVE.lumen))
    ]
  }),
  'log-pack': () => ({
    body: [
      turned(cylinder([0, 0.5, -0.18], [0.16, 0.42, 0.16], GROVE.bark), ON_ITS_SIDE),
      turned(cylinder([0, 0.64, -0.17], [0.11, 0.34, 0.11], GROVE.paper), ON_ITS_SIDE)
    ]
  }),
  scroll: () => ({
    leftArm: [turned(cylinder([0, -0.3, 0.06], [0.05, 0.2, 0.05], GROVE.paper), ON_ITS_SIDE)],
    body: [turned(cylinder([0.08, 0.52, KEEPER_BACK], [0.07, 0.4, 0.07], GROVE.paper), [0, 0, 0.5])]
  }),
  satchel: () => ({
    body: [
      box([0.17, 0.36, 0.04], [0.1, 0.14, 0.17], GROVE.bark),
      turned(box([0, 0.53, 0.11], [0.04, 0.38, 0.01], GROVE.bark), [0, 0, 0.6])
    ]
  }),
  broom: () => ({
    body: [
      turned(cylinder([0.05, 0.62, KEEPER_BACK], [0.025, 0.9, 0.025], GROVE.bark), [0, 0, -0.5]),
      turned(box([0.29, 1.06, KEEPER_BACK], [0.16, 0.14, 0.05], GROVE.timber), [0, 0, -0.5])
    ]
  }),
  pail: () => ({
    body: [
      cylinder([0, 0.36, HELPER_BACK], [0.2, 0.18, 0.16], GROVE.bark),
      cylinder([0, 0.455, HELPER_BACK], [0.17, 0.02, 0.13], GROVE.pond)
    ]
  }),
  shovel: () => ({
    body: [
      turned(cylinder([0.06, 0.46, HELPER_BACK], [0.025, 0.7, 0.025], GROVE.bark), [0, 0, -0.4]),
      turned(box([0.21, 0.82, HELPER_BACK], [0.13, 0.16, 0.02], GROVE.paper), [0, 0, -0.4])
    ]
  }),
  'scarf-tail': ({ trim }) => ({
    body: [turned(box([0.12, 0.38, HELPER_BACK], [0.09, 0.3, 0.03], trim), [0, 0, -0.2])]
  }),
  'back-lantern': () => ({
    body: [
      cylinder([0, 0.66, HELPER_BACK], [0.02, 0.44, 0.02], GROVE.bark),
      lit(sphere([0, 0.9, HELPER_BACK], [0.13, 0.15, 0.13], GROVE.lumen))
    ]
  }),
  'wide-brim': ({ trim }) => ({
    head: [
      cylinder([0, 0.25, -0.05], [0.46, 0.03, 0.44], GROVE.timber),
      cylinder([0, 0.3, -0.05], [0.24, 0.1, 0.23], GROVE.timber),
      cylinder([0, 0.27, -0.05], [0.25, 0.03, 0.24], trim)
    ]
  }),
  kerchief: ({ trim }) => ({
    head: [
      cylinder([0, 0.2, -0.02], [0.33, 0.08, 0.32], trim),
      sphere([0.14, 0.2, -0.13], [0.1, 0.1, 0.1], trim),
      turned(box([0.17, 0.1, -0.15], [0.06, 0.16, 0.02], trim), [0, 0, 0.3])
    ]
  }),
  'antler-twigs': () => ({
    head: SIDES.flatMap((side) => [
      turned(cylinder([side * 0.11, 0.33, -0.02], [0.03, 0.24, 0.03], GROVE.bark), [
        0,
        0,
        -side * 0.5
      ]),
      turned(cylinder([side * 0.19, 0.37, -0.02], [0.025, 0.12, 0.025], GROVE.bark), [
        0,
        0,
        side * 0.5
      ])
    ])
  }),
  'mushroom-cap': () => ({
    head: [
      sphere([0, 0.27, -0.03], [0.5, 0.22, 0.46], GROVE.clay),
      sphere([-0.1, 0.35, 0.02], [0.09, 0.05, 0.09], GROVE.paper),
      sphere([0.09, 0.36, -0.08], [0.11, 0.05, 0.11], GROVE.paper)
    ]
  }),
  'shell-cap': () => ({
    head: [
      cylinder([0, 0.24, -0.03], [0.34, 0.04, 0.32], GROVE.pond),
      cone([0, 0.36, -0.03], [0.3, 0.22, 0.28], GROVE.paper)
    ]
  }),
  'acorn-cap': () => ({
    head: [
      cylinder([0, 0.25, -0.02], [0.36, 0.08, 0.34], GROVE.bark),
      cylinder([0.02, 0.33, -0.02], [0.04, 0.1, 0.04], GROVE.bark)
    ]
  })
}
