import type { Vector } from '../primitives'
import { box, turned, type PartSpec } from '../parts'
import type { GroveCharacter, SpiritFeature } from './cast'
import { GROVE } from './palette'

export type SpiritJoint = 'base' | 'legs' | 'body' | 'leftArm' | 'rightArm' | 'head' | 'gear'
export type SpiritParts = Record<SpiritJoint, PartSpec[]>

export const ball = (at: Vector, size: Vector, color: string): PartSpec => ({
  shape: 'sphere',
  at,
  size,
  color
})
export const tube = (at: Vector, size: Vector, color: string): PartSpec => ({
  shape: 'cylinder',
  at,
  size,
  color
})
export const spike = (at: Vector, size: Vector, color: string): PartSpec => ({
  shape: 'cone',
  at,
  size,
  color
})
export const lit = (part: PartSpec): PartSpec => ({ ...part, glow: true })

const SIDES = [-1, 1] as const
const ON_ITS_SIDE: Vector = [0, 0, Math.PI / 2]
const KEEPER_BACK = -0.14
const HELPER_BACK = -0.2

// What each feature adds, and to which joint. Head pieces are head-local; a keeper's head tops
// out at 0.24 and a helper's at 0.26. Hats stay narrow and sit back, so the face shows from above. Back pieces sit wide so they still read from the front.
export const FEATURE_PARTS: Record<SpiritFeature, (who: GroveCharacter) => Partial<SpiritParts>> = {
  'straw-hat': () => ({ head: [spike([0, 0.3, -0.05], [0.44, 0.2, 0.44], GROVE.timber)] }),
  'bark-cap': () => ({
    head: [
      tube([0, 0.24, -0.03], [0.3, 0.07, 0.28], GROVE.bark),
      box([0, 0.215, 0.13], [0.22, 0.02, 0.1], GROVE.bark)
    ]
  }),
  'leaf-crown': () => ({
    head: [-1, 0, 1].map((lean) =>
      turned(
        spike([lean * 0.1, 0.31 - Math.abs(lean) * 0.03, -0.03], [0.1, 0.2, 0.05], GROVE.fern),
        [0, 0, -lean * 0.5]
      )
    )
  }),
  'top-knot': () => ({
    head: [
      tube([0, 0.22, -0.02], [0.23, 0.06, 0.22], GROVE.bark),
      ball([0, 0.3, -0.03], [0.14, 0.14, 0.14], GROVE.bark),
      box([0, 0.31, -0.03], [0.26, 0.02, 0.02], GROVE.paper)
    ]
  }),
  'pine-hood': () => ({ head: [spike([0, 0.33, -0.06], [0.3, 0.3, 0.28], GROVE.pine)] }),
  'reed-tuft': () => ({
    head: [-1, 0, 1].map((lean) =>
      turned(
        tube([lean * 0.05, 0.335 - Math.abs(lean) * 0.02, 0], [0.025, 0.2, 0.025], GROVE.fern),
        [0, 0, -lean * 0.25]
      )
    )
  }),
  'cap-shade': () => ({ head: [ball([0, 0.27, -0.05], [0.44, 0.18, 0.4], GROVE.pond)] }),
  'lily-pad': () => ({
    head: [
      tube([0, 0.27, -0.05], [0.42, 0.03, 0.4], GROVE.fern),
      ball([0.07, 0.32, -0.03], [0.1, 0.1, 0.1], GROVE.paper)
    ]
  }),
  'twin-leaves': () => ({
    head: SIDES.map((side) =>
      turned(spike([side * 0.09, 0.33, -0.02], [0.1, 0.22, 0.04], GROVE.fern), [0, 0, -side * 0.7])
    )
  }),
  'pebble-crest': () => ({
    head: [
      ball([0, 0.28, -0.02], [0.19, 0.1, 0.17], GROVE.moss),
      ball([0, 0.35, -0.02], [0.12, 0.08, 0.11], GROVE.paper)
    ]
  }),
  'lantern-staff': () => ({
    body: [
      tube([-0.22, 0.6, KEEPER_BACK], [0.025, 1.1, 0.025], GROVE.bark),
      lit(ball([-0.22, 1.2, KEEPER_BACK], [0.13, 0.16, 0.13], GROVE.lumen))
    ]
  }),
  'log-pack': () => ({
    body: [
      turned(tube([0, 0.5, -0.18], [0.16, 0.42, 0.16], GROVE.bark), ON_ITS_SIDE),
      turned(tube([0, 0.64, -0.17], [0.11, 0.34, 0.11], GROVE.paper), ON_ITS_SIDE)
    ]
  }),
  scroll: () => ({
    leftArm: [turned(tube([0, -0.3, 0.06], [0.05, 0.2, 0.05], GROVE.paper), ON_ITS_SIDE)],
    body: [turned(tube([0.08, 0.52, KEEPER_BACK], [0.07, 0.4, 0.07], GROVE.paper), [0, 0, 0.5])]
  }),
  satchel: () => ({
    body: [
      box([0.17, 0.36, 0.04], [0.1, 0.14, 0.17], GROVE.bark),
      turned(box([0, 0.53, 0.11], [0.04, 0.38, 0.01], GROVE.bark), [0, 0, 0.6])
    ]
  }),
  broom: () => ({
    body: [
      turned(tube([0.05, 0.62, KEEPER_BACK], [0.025, 0.9, 0.025], GROVE.bark), [0, 0, -0.5]),
      turned(box([0.29, 1.06, KEEPER_BACK], [0.16, 0.14, 0.05], GROVE.timber), [0, 0, -0.5])
    ]
  }),
  pail: () => ({
    body: [
      tube([0, 0.36, HELPER_BACK], [0.2, 0.18, 0.16], GROVE.bark),
      tube([0, 0.455, HELPER_BACK], [0.17, 0.02, 0.13], GROVE.pond)
    ]
  }),
  shovel: () => ({
    body: [
      turned(tube([0.06, 0.46, HELPER_BACK], [0.025, 0.7, 0.025], GROVE.bark), [0, 0, -0.4]),
      turned(box([0.21, 0.82, HELPER_BACK], [0.13, 0.16, 0.02], GROVE.paper), [0, 0, -0.4])
    ]
  }),
  'scarf-tail': ({ trim }) => ({
    body: [turned(box([0.12, 0.38, HELPER_BACK], [0.09, 0.3, 0.03], trim), [0, 0, -0.2])]
  }),
  'back-lantern': () => ({
    body: [
      tube([0, 0.66, HELPER_BACK], [0.02, 0.44, 0.02], GROVE.bark),
      lit(ball([0, 0.9, HELPER_BACK], [0.13, 0.15, 0.13], GROVE.lumen))
    ]
  })
}
