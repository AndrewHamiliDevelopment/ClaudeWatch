import { hashOf } from './lot-math'
import { box, cylinder, SIDES, turned, type PartSpec } from './parts'
import type { Vector } from './primitives'
import type { RobotModelProps } from './types'

export type SteamJoints = Record<
  'base' | 'legs' | 'body' | 'leftArm' | 'rightArm' | 'head' | 'gear',
  PartSpec[]
>

// Reuse the lot hash; independent bits keep nearby keys from sharing an entire silhouette.
export function steamVariant(agentKey: string) {
  const seed = hashOf(agentKey)
  return { headgear: seed % 8, build: (seed >>> 8) % 3, back: (seed >>> 16) % 3 }
}

export function steamPivot(
  build: number
): Record<'leftArm' | 'rightArm' | 'head' | 'gear', Vector> {
  return {
    leftArm: [-0.23, 0.63, 0],
    rightArm: [0.23, 0.63, 0],
    head: [0, [0.8, 0.78, 0.86][build], 0],
    gear: [0, 0.52, -0.2]
  }
}

export function steamJoints({ skin }: Pick<RobotModelProps, 'skin'>, dark: string): SteamJoints {
  const arm = () => [
    box([0, -0.14, 0], [0.075, 0.28, 0.09], skin.trim),
    box([0, -0.3, 0.025], [0.09, 0.06, 0.12], dark)
  ]
  return {
    base: SIDES.map((side) => box([side * 0.1, 0.075, 0.035], [0.13, 0.1, 0.2], dark)),
    legs: SIDES.map((side) => box([side * 0.1, 0.25, 0], [0.08, 0.25, 0.1], skin.body)),
    body: [],
    leftArm: arm(),
    rightArm: arm(),
    head: [],
    gear: [
      turned(cylinder([0, 0, 0], [0.16, 0.035, 0.16], skin.trim), [Math.PI / 2, 0, 0]),
      ...SIDES.flatMap((side) => [
        box([side * 0.09, 0, 0], [0.045, 0.05, 0.04], skin.trim),
        box([0, side * 0.09, 0], [0.05, 0.045, 0.04], skin.trim)
      ])
    ]
  }
}
