import type { Vector } from '../primitives'
import type { CourtCharacter, PilotFeature } from './cast'
import { COURT } from './palette'
import { box, turned, type PartSpec } from './Parts'

type PilotJoint = 'base' | 'legs' | 'body' | 'leftArm' | 'rightArm' | 'head' | 'gear'
type PilotParts = Record<PilotJoint, PartSpec[]>

// Where each rig joint pivots, in the model's own metres; a joint's parts are relative to it.
export const PILOT_PIVOT: Record<'leftArm' | 'rightArm' | 'head' | 'gear', Vector> = {
  leftArm: [-0.2, 0.62, 0],
  rightArm: [0.2, 0.62, 0],
  head: [0, 0.8, 0],
  gear: [0.28, 0.98, -0.02]
}

const BACK = -0.135

// What each feature adds, and to which joint. Back pieces are wider than the torso so the
// silhouette still reads from the front.
const FEATURE_PARTS: Record<PilotFeature, (who: CourtCharacter) => Partial<PilotParts>> = {
  mask: () => ({
    head: [
      box([0, 0.05, 0.07], [0.25, 0.24, 0.13], COURT.ink),
      box([0, 0.2, 0], [0.05, 0.04, 0.24], COURT.gold)
    ]
  }),
  'high-collar': ({ trim }) => ({ body: [box([0, 0.78, BACK], [0.44, 0.3, 0.04], trim)] }),
  cloak: ({ trim }) => ({ body: [box([0, 0.4, BACK], [0.5, 0.66, 0.04], trim)] }),
  cape: () => ({ body: [box([0, 0.5, BACK], [0.42, 0.4, 0.04], COURT.gold)] }),
  blades: () => ({
    body: [-0.7, 0.7].map((lean) =>
      turned(box([0, 0.6, BACK], [0.04, 0.62, 0.02], COURT.marble), [0, 0, lean])
    )
  }),
  banner: ({ trim }) => ({
    body: [
      { shape: 'cylinder', at: [0.14, 0.82, BACK], size: [0.025, 0.95, 0.025], color: COURT.gold },
      box([0.27, 1.17, BACK], [0.24, 0.2, 0.015], trim)
    ]
  }),
  pack: () => ({ body: [box([0, 0.52, -0.15], [0.26, 0.28, 0.12], COURT.slate)] }),
  epaulettes: () => ({
    body: [-1, 1].map((side) => box([side * 0.19, 0.665, 0], [0.11, 0.035, 0.21], COURT.gold))
  }),
  'long-hair': ({ hair }) => ({ head: [box([0, -0.08, -0.12], [0.26, 0.36, 0.06], hair)] }),
  ponytail: ({ hair }) => ({ head: [box([0, -0.02, -0.17], [0.07, 0.28, 0.07], hair)] }),
  cap: ({ jacket, trim }) => ({
    head: [
      box([0, 0.215, 0], [0.31, 0.06, 0.31], jacket),
      box([0, 0.185, 0.15], [0.25, 0.02, 0.09], trim)
    ]
  }),
  helmet: ({ trim }) => ({ head: [box([0, 0.13, -0.01], [0.3, 0.15, 0.29], trim)] }),
  goggles: () => ({ head: [box([0, 0.14, 0.11], [0.25, 0.05, 0.04], COURT.gold)] }),
  tablet: () => ({
    leftArm: [{ ...box([0, -0.3, 0.07], [0.13, 0.17, 0.015], COURT.lumen), glow: true }]
  })
}

function uniform(who: CourtCharacter): PilotParts {
  const arm = (): PartSpec[] => [
    box([0, -0.13, 0], [0.085, 0.26, 0.1], who.jacket),
    box([0, -0.25, 0], [0.095, 0.05, 0.11], who.trim),
    box([0, -0.3, 0], [0.07, 0.06, 0.08], COURT.skin)
  ]
  return {
    base: [-1, 1].map((side) => box([side * 0.08, 0.04, 0.02], [0.11, 0.08, 0.18], COURT.ink)),
    legs: [-1, 1].map((side) => box([side * 0.08, 0.22, 0], [0.1, 0.28, 0.12], who.trousers)),
    body: [
      box([0, 0.5, 0], [0.3, 0.3, 0.18], who.jacket),
      box([0, 0.37, 0], [0.31, 0.045, 0.19], COURT.gold),
      box([0, 0.52, 0.095], [0.06, 0.24, 0.02], who.trim)
    ],
    leftArm: arm(),
    rightArm: arm(),
    head: [
      { shape: 'sphere', at: [0, 0.06, 0], size: [0.26, 0.26, 0.24], color: COURT.skin },
      box([0, 0.15, -0.01], [0.27, 0.09, 0.26], who.hair),
      box([0, 0.06, -0.11], [0.27, 0.2, 0.06], who.hair)
    ],
    // A link shard beside the pilot: the rig spins it while the agent works.
    gear: [
      {
        ...turned(box([0, 0, 0], [0.08, 0.08, 0.02], COURT.lumen), [0, 0, Math.PI / 4]),
        glow: true
      }
    ]
  }
}

const JOINTS: readonly PilotJoint[] = [
  'base',
  'legs',
  'body',
  'leftArm',
  'rightArm',
  'head',
  'gear'
]

export function pilotParts(who: CourtCharacter): PilotParts {
  const parts = uniform(who)
  for (const feature of who.features) {
    const added = FEATURE_PARTS[feature](who)
    for (const joint of JOINTS) parts[joint].push(...(added[joint] ?? []))
  }
  return parts
}
