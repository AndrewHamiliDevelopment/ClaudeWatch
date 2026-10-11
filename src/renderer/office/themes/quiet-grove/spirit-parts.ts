import type { Vector } from '../primitives'
import { box, turned, type PartSpec } from '../parts'
import type { GroveCharacter } from './cast'
import { GROVE } from './palette'
import {
  ball,
  FEATURE_PARTS,
  lit,
  spike,
  tube,
  type SpiritJoint,
  type SpiritParts
} from './spirit-features'

export interface SpiritBuild {
  // Where each rig joint pivots, in the model's own metres; a joint's parts are relative to it.
  pivot: Record<'leftArm' | 'rightArm' | 'head' | 'gear', Vector>
  // Head-local centre of the glowing eye band.
  eye: { at: Vector; size: Vector }
  // Above the tallest hat: where thought dots float.
  crown: number
  joints: SpiritParts
  // Right-arm-local, shown only while the agent needs the owner.
  beacon: PartSpec[]
}

const SIDES = [-1, 1] as const
// One size for every figure, so the cast shares one eye geometry per provider.
const EYE_SIZE: Vector = [0.19, 0.055, 0.03]

// A dark face plate for the eye band to glow in, and a bridge that splits the band into two
// eyes that blink together. `front` is where the head's surface is, head-local.
const face = (y: number, front: number, width = 0.25): PartSpec[] => [
  box([0, y, front - 0.01], [width, 0.12, 0.03], GROVE.soil),
  box([0, y, front + 0.015], [0.035, 0.07, 0.02], GROVE.soil)
]
const eyeAt = (y: number, front: number): Vector => [0, y, front + 0.002]

// A paper lantern on a short pole in the raised hand, held clear of the face; `reach` is how
// far along the arm the hand is, `lean` how far the arm splays sideways.
function lantern(reach: number, width: number, lean = 0): PartSpec[] {
  const along = (distance: number): Vector => [distance * lean, -distance, 0]
  const centre = reach + 0.34
  return [
    lit({
      shape: 'sphere',
      at: along(centre),
      size: [width, width * 1.15, width],
      color: GROVE.beacon
    }),
    ...[-1, 1].map((end) =>
      tube(along(centre + end * width * 0.6), [width * 0.5, 0.03, width * 0.5], GROVE.bark)
    ),
    turned(tube(along(reach + 0.1), [0.02, 0.3, 0.02], GROVE.bark), [0, 0, Math.atan(lean)])
  ]
}

const pinwheel = (color: string): PartSpec[] => [
  box([0, 0, 0], [0.2, 0.045, 0.015], GROVE.paper),
  box([0, 0, 0.004], [0.045, 0.2, 0.015], color)
]

// Tall and warm: a robed caretaker with a paper-lantern face.
function keeper(who: GroveCharacter): SpiritBuild {
  const arm = (): PartSpec[] => [
    box([0, -0.13, 0], [0.09, 0.26, 0.1], who.body),
    ball([0, -0.3, 0], [0.085, 0.085, 0.085], GROVE.paper)
  ]
  return {
    pivot: {
      leftArm: [-0.19, 0.64, 0],
      rightArm: [0.19, 0.64, 0],
      head: [0, 0.8, 0],
      gear: [0.31, 1, -0.06]
    },
    eye: { at: eyeAt(0.09, 0.15), size: EYE_SIZE },
    crown: 1.4,
    joints: {
      base: SIDES.map((side) => box([side * 0.08, 0.03, 0.04], [0.1, 0.06, 0.16], GROVE.soil)),
      legs: [spike([0, 0.26, 0], [0.42, 0.52, 0.36], who.body)],
      body: [
        tube([0, 0.52, 0], [0.28, 0.32, 0.22], who.body),
        tube([0, 0.41, 0], [0.3, 0.05, 0.24], who.trim),
        tube([0, 0.7, 0], [0.16, 0.06, 0.14], who.trim),
        tube([0.31, 0.8, -0.08], [0.02, 0.4, 0.02], GROVE.bark)
      ],
      leftArm: arm(),
      rightArm: arm(),
      head: [ball([0, 0.09, 0], [0.32, 0.3, 0.3], GROVE.paper), ...face(0.09, 0.15)],
      gear: pinwheel(who.body)
    },
    beacon: lantern(0.3, 0.32)
  }
}

// Small and cool: a round river-stone helper in a pond-coloured scarf.
function helper(who: GroveCharacter): SpiritBuild {
  const arm = (): PartSpec[] => [
    tube([0, -0.11, 0], [0.09, 0.22, 0.09], who.body),
    ball([0, -0.24, 0], [0.095, 0.095, 0.095], who.trim)
  ]
  return {
    pivot: {
      leftArm: [-0.24, 0.46, 0],
      rightArm: [0.24, 0.46, 0],
      head: [0, 0.54, 0],
      gear: [0.32, 0.72, -0.04]
    },
    eye: { at: eyeAt(0.11, 0.17), size: EYE_SIZE },
    crown: 1.2,
    joints: {
      base: SIDES.map((side) => box([side * 0.09, 0.03, 0.04], [0.11, 0.06, 0.16], GROVE.soil)),
      legs: SIDES.map((side) => tube([side * 0.09, 0.12, 0], [0.1, 0.14, 0.1], who.body)),
      body: [
        ball([0, 0.34, 0], [0.42, 0.4, 0.34], who.body),
        tube([0, 0.52, 0], [0.3, 0.07, 0.27], who.trim)
      ],
      leftArm: arm(),
      rightArm: arm(),
      head: [ball([0, 0.11, 0], [0.38, 0.3, 0.34], who.body), ...face(0.11, 0.17)],
      gear: pinwheel(who.trim)
    },
    beacon: lantern(0.24, 0.32)
  }
}

const LEAF_SPLAY = 0.78

// A seedling in a pot: its two leaves are its arms, so they wave and type like anyone's.
function sprout(who: GroveCharacter): SpiritBuild {
  const leaf = (side: number): PartSpec[] => [
    turned(ball([side * 0.085, -0.085, 0], [0.08, 0.26, 0.13], GROVE.fern), [
      0,
      0,
      side * LEAF_SPLAY
    ])
  ]
  return {
    pivot: {
      leftArm: [-0.03, 0.42, 0],
      rightArm: [0.03, 0.42, 0],
      head: [0, 0.52, 0],
      gear: [0.22, 0.7, 0]
    },
    eye: { at: eyeAt(0.08, 0.115), size: EYE_SIZE },
    crown: 1.05,
    joints: {
      base: [tube([0, 0.02, 0], [0.32, 0.04, 0.32], GROVE.bark)],
      legs: [],
      body: [
        tube([0, 0.15, 0], [0.26, 0.22, 0.26], who.body),
        tube([0, 0.27, 0], [0.3, 0.05, 0.3], who.body),
        tube([0, 0.3, 0], [0.24, 0.02, 0.24], GROVE.soil),
        tube([0, 0.4, 0], [0.05, 0.2, 0.05], GROVE.fern)
      ],
      leftArm: leaf(-1),
      rightArm: leaf(1),
      head: [
        ball([0, 0.08, 0], [0.25, 0.23, 0.23], GROVE.fern),
        spike([0, 0.24, 0], [0.09, 0.14, 0.09], GROVE.moss),
        ...face(0.08, 0.115, 0.21)
      ],
      gear: pinwheel(who.trim)
    },
    beacon: lantern(0.14, 0.26, 1)
  }
}

const JOINTS: readonly SpiritJoint[] = [
  'base',
  'legs',
  'body',
  'leftArm',
  'rightArm',
  'head',
  'gear'
]

export function spiritBuild(who: GroveCharacter): SpiritBuild {
  const build = who.isSprout ? sprout(who) : who.kin === 'keeper' ? keeper(who) : helper(who)
  for (const feature of who.features) {
    const added = FEATURE_PARTS[feature](who)
    for (const joint of JOINTS) build.joints[joint].push(...(added[joint] ?? []))
  }
  return build
}
