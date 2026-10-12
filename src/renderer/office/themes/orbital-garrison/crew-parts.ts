import type { Vector } from '../primitives'
import { box, cone, sphere, turned, type PartSpec, lit, SIDES } from '../parts'
import { GARRISON } from './palette'
import type { CrewFeature, GarrisonCharacter } from './section'

type CrewJoint = 'base' | 'legs' | 'body' | 'leftArm' | 'rightArm' | 'head' | 'gear'
type CrewParts = Record<CrewJoint, PartSpec[]>

// Where each rig joint pivots, in the model's own metres; a joint's parts are relative to it.
export const CREW_PIVOT: Record<'leftArm' | 'rightArm' | 'head' | 'gear', Vector> = {
  leftArm: [-0.21, 0.63, 0],
  rightArm: [0.21, 0.63, 0],
  head: [0, 0.8, 0],
  gear: [-0.3, 1, -0.02]
}

const BACK = -0.14
const rod = (at: Vector, size: Vector, color: string): PartSpec => ({
  shape: 'cylinder',
  at,
  size,
  color
})

const earCups = (size: Vector, color: string): PartSpec[] => [
  box([0, 0.21, 0], [0.3, 0.03, 0.05], color),
  ...SIDES.map((side) => box([side * 0.15, 0.07, 0], size, color))
]

// What each feature adds, and to which joint. Back pieces are wider than the torso so the
// silhouette still reads from the front.
const FEATURE_PARTS: Record<CrewFeature, (who: GarrisonCharacter) => Partial<CrewParts>> = {
  'peaked-cap': () => ({
    head: [
      box([0, 0.215, 0], [0.31, 0.07, 0.31], GARRISON.navy),
      box([0, 0.185, 0.16], [0.25, 0.02, 0.1], GARRISON.hull),
      box([0, 0.22, 0.16], [0.07, 0.04, 0.012], GARRISON.orange)
    ]
  }),
  greatcoat: () => ({
    body: [
      box([0, 0.4, BACK], [0.52, 0.68, 0.04], GARRISON.navy),
      box([0, 0.71, BACK + 0.03], [0.42, 0.1, 0.1], GARRISON.navy)
    ]
  }),
  'shoulder-boards': ({ trim }) => ({
    body: SIDES.map((side) => box([side * 0.2, 0.67, 0], [0.13, 0.035, 0.21], trim))
  }),
  'flight-helmet': ({ headgear }) => ({
    head: [
      box([0, 0.14, -0.02], [0.31, 0.17, 0.29], headgear),
      ...SIDES.map((side) => box([side * 0.14, 0.02, -0.02], [0.04, 0.14, 0.2], headgear)),
      box([0, 0.232, -0.02], [0.07, 0.02, 0.29], GARRISON.orange),
      box([0, 0.2, 0.13], [0.24, 0.06, 0.05], GARRISON.navy)
    ]
  }),
  'hard-hat': ({ headgear }) => ({
    head: [
      box([0, 0.205, -0.005], [0.29, 0.09, 0.29], headgear),
      box([0, 0.165, 0.03], [0.33, 0.025, 0.36], headgear)
    ]
  }),
  headset: () => ({
    head: [
      ...earCups([0.05, 0.11, 0.11], GARRISON.hull),
      box([0.09, -0.01, 0.12], [0.1, 0.02, 0.02], GARRISON.hull)
    ]
  }),
  'ear-defenders': ({ headgear }) => ({ head: earCups([0.07, 0.14, 0.14], headgear) }),
  // Stops under the thought dots.
  antenna: () => ({ head: [rod([-0.15, 0.27, -0.02], [0.02, 0.24, 0.02], GARRISON.steel)] }),
  goggles: () => ({ head: [box([0, 0.15, 0.11], [0.25, 0.055, 0.04], GARRISON.steel)] }),
  respirator: () => ({ head: [box([0, -0.005, 0.11], [0.15, 0.09, 0.07], GARRISON.hull)] }),
  braid: ({ hair }) => ({ head: [box([0, -0.04, -0.16], [0.07, 0.3, 0.07], hair)] }),
  scarf: ({ trim }) => ({
    body: [
      box([0, 0.68, 0.01], [0.25, 0.06, 0.25], trim),
      box([0.09, 0.53, 0.11], [0.07, 0.26, 0.02], trim)
    ]
  }),
  bandolier: () => ({
    body: [
      turned(box([0, 0.52, 0.108], [0.05, 0.38, 0.02], GARRISON.steel), [0, 0, 0.75]),
      box([-0.1, 0.42, 0.115], [0.08, 0.07, 0.04], GARRISON.gunmetal)
    ]
  }),
  'hi-vis-bands': ({ trim }) => ({
    body: [0.45, 0.58].map((y) => box([0, y, 0], [0.33, 0.04, 0.21], trim))
  }),
  'tool-pack': () => ({
    body: [
      box([0, 0.52, -0.16], [0.27, 0.28, 0.12], GARRISON.gunmetal),
      rod([0.08, 0.74, -0.16], [0.03, 0.22, 0.03], GARRISON.steel)
    ]
  }),
  'tank-pack': () => ({
    body: SIDES.map((side) => rod([side * 0.07, 0.54, -0.16], [0.11, 0.34, 0.11], GARRISON.steel))
  }),
  tablet: () => ({ leftArm: [lit(box([0, -0.3, 0.07], [0.13, 0.17, 0.015], GARRISON.ice))] }),
  wands: () => {
    const wand = (): PartSpec[] => [
      lit(box([0, -0.4, 0.02], [0.035, 0.16, 0.035], GARRISON.orange))
    ]
    return { leftArm: wand(), rightArm: wand() }
  },
  beret: ({ headgear, trim }) => ({
    head: [
      sphere([0.04, 0.2, -0.01], [0.36, 0.1, 0.33], headgear),
      box([-0.07, 0.2, 0.135], [0.05, 0.04, 0.012], trim)
    ]
  }),
  'visor-cap': ({ headgear, trim }) => ({
    head: [
      box([0, 0.2, -0.02], [0.29, 0.08, 0.27], headgear),
      box([0, 0.17, 0.19], [0.22, 0.02, 0.16], headgear),
      box([0, 0.245, -0.02], [0.05, 0.02, 0.05], trim)
    ]
  }),
  'side-cap': ({ headgear, trim }) => ({
    head: [
      box([0, 0.23, -0.01], [0.13, 0.1, 0.3], headgear),
      box([0, 0.19, -0.01], [0.16, 0.03, 0.31], trim)
    ]
  }),
  // Stops short of the face, so the visor band still shows.
  hood: ({ suit, trim }) => ({
    head: [
      box([0, 0.09, -0.04], [0.32, 0.3, 0.26], suit),
      box([0, 0.245, -0.04], [0.33, 0.02, 0.27], trim)
    ]
  }),
  // Flipped up over the brow: down, it would cover the visor band.
  'weld-mask': () => ({
    head: [
      turned(box([0, 0.27, 0.07], [0.24, 0.2, 0.03], GARRISON.gunmetal), [-1, 0, 0]),
      box([0, 0.2, -0.01], [0.3, 0.04, 0.29], GARRISON.hull)
    ]
  }),
  'chart-tube': () => ({
    body: [
      turned(rod([0, 0.6, BACK - 0.03], [0.09, 0.64, 0.09], GARRISON.steel), [0, 0, 1.25]),
      turned(box([0, 0.52, 0.108], [0.04, 0.38, 0.02], GARRISON.gunmetal), [0, 0, -0.75])
    ]
  }),
  'medic-bag': ({ trim }) => ({
    body: [
      box([0.2, 0.35, 0.03], [0.11, 0.16, 0.2], trim),
      box([0.258, 0.35, 0.03], [0.01, 0.1, 0.04], GARRISON.white),
      box([0.258, 0.35, 0.03], [0.01, 0.04, 0.1], GARRISON.white),
      turned(box([0, 0.52, 0.108], [0.04, 0.4, 0.02], trim), [0, 0, 0.75])
    ]
  }),
  'jet-pack': ({ trim }) => ({
    body: [
      box([0, 0.54, -0.17], [0.26, 0.3, 0.12], GARRISON.gunmetal),
      ...SIDES.flatMap((side) => [
        rod([side * 0.21, 0.5, -0.17], [0.11, 0.38, 0.11], GARRISON.steel),
        cone([side * 0.21, 0.27, -0.17], [0.13, 0.1, 0.13], GARRISON.hull),
        box([side * 0.21, 0.74, -0.17], [0.03, 0.12, 0.1], trim)
      ])
    ]
  }),
  // Slung on the back and wider than the torso, so its rim frames the wearer from the front.
  'cable-coil': () => ({
    body: [
      turned(rod([0.06, 0.5, BACK - 0.03], [0.46, 0.07, 0.46], GARRISON.hull), [Math.PI / 2, 0, 0]),
      box([0.3, 0.3, BACK], [0.03, 0.16, 0.03], GARRISON.hull)
    ]
  }),
  crate: ({ trim }) => ({
    body: [
      box([0, 0.58, -0.21], [0.44, 0.34, 0.2], GARRISON.steel),
      box([0, 0.58, -0.21], [0.08, 0.35, 0.21], trim),
      box([0, 0.78, -0.21], [0.3, 0.06, 0.16], GARRISON.gunmetal)
    ]
  }),
  extinguisher: () => ({
    body: [
      rod([0.1, 0.56, -0.18], [0.15, 0.4, 0.15], GARRISON.white),
      rod([0.1, 0.79, -0.18], [0.05, 0.07, 0.05], GARRISON.hull),
      box([0.17, 0.82, -0.18], [0.12, 0.025, 0.03], GARRISON.hull)
    ]
  }),
  'dish-pack': () => ({
    body: [
      box([0, 0.52, -0.16], [0.26, 0.26, 0.12], GARRISON.gunmetal),
      rod([0.2, 0.84, -0.16], [0.02, 0.4, 0.02], GARRISON.steel),
      turned(rod([0.2, 1.05, -0.14], [0.26, 0.03, 0.26], GARRISON.white), [1, 0, 0])
    ]
  }),
  tripod: () => ({
    body: [
      ...[-0.25, -0.21, -0.17].map((x) =>
        rod([x, 0.62, BACK - 0.02], [0.02, 0.8, 0.02], GARRISON.steel)
      ),
      box([-0.21, 1.05, BACK - 0.02], [0.13, 0.08, 0.11], GARRISON.gunmetal),
      lit(box([-0.21, 1.05, BACK + 0.04], [0.06, 0.04, 0.01], GARRISON.ice))
    ]
  }),
  'signal-flag': ({ trim }) => ({
    body: [
      rod([0.16, 0.84, BACK], [0.02, 0.95, 0.02], GARRISON.steel),
      box([0.29, 1.2, BACK], [0.24, 0.16, 0.015], trim)
    ]
  })
}

function suit(who: GarrisonCharacter): CrewParts {
  const arm = (): PartSpec[] => [
    box([0, -0.13, 0], [0.09, 0.26, 0.105], who.suit),
    box([0, -0.25, 0], [0.1, 0.05, 0.115], who.trim),
    box([0, -0.3, 0], [0.08, 0.065, 0.09], GARRISON.hull)
  ]
  return {
    base: SIDES.map((side) => box([side * 0.085, 0.045, 0.02], [0.12, 0.09, 0.2], GARRISON.hull)),
    legs: SIDES.map((side) => box([side * 0.085, 0.22, 0], [0.11, 0.27, 0.13], who.suit)),
    body: [
      box([0, 0.5, 0], [0.32, 0.3, 0.2], who.suit),
      box([0, 0.365, 0], [0.33, 0.05, 0.21], GARRISON.hull),
      // Harness straps and the helmet seal ring every suit carries.
      ...SIDES.map((side) => box([side * 0.085, 0.53, 0.105], [0.045, 0.24, 0.02], who.trim)),
      rod([0, 0.665, 0], [0.21, 0.04, 0.21], GARRISON.steel)
    ],
    leftArm: arm(),
    rightArm: arm(),
    head: [
      { shape: 'sphere', at: [0, 0.06, 0], size: [0.26, 0.26, 0.24], color: who.skin },
      box([0, 0.15, -0.01], [0.27, 0.09, 0.26], who.hair),
      box([0, 0.06, -0.11], [0.27, 0.2, 0.06], who.hair)
    ],
    // A small signal rotor over the shoulder: the rig spins it while the agent works.
    gear: [
      lit(box([0, 0, 0], [0.12, 0.03, 0.02], GARRISON.ice)),
      lit(box([0, 0, 0], [0.03, 0.12, 0.02], GARRISON.ice))
    ]
  }
}

const JOINTS: readonly CrewJoint[] = ['base', 'legs', 'body', 'leftArm', 'rightArm', 'head', 'gear']

export function crewParts(who: GarrisonCharacter): CrewParts {
  const parts = suit(who)
  for (const feature of who.features) {
    const added = FEATURE_PARTS[feature](who)
    for (const joint of JOINTS) parts[joint].push(...(added[joint] ?? []))
  }
  return parts
}
