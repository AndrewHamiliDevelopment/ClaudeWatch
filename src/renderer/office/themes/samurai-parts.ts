import { EDO } from './palettes'
import { box, cone, cylinder, sphere, SIDES, turned, type PartSpec } from './parts'
import { steamJoints, steamVariant } from './steam-variant'
import type { Vector } from './primitives'
import type { RobotModelProps } from './types'

const BUILDS: readonly Vector[] = [
  [0.24, 0.36, 0.18],
  [0.38, 0.28, 0.25],
  [0.27, 0.42, 0.19]
]

function crest(kind: number, trim: string): PartSpec[] {
  switch (kind) {
    case 0:
      return [
        box([0, 0.16, 0.1], [0.18, 0.035, 0.03], trim),
        ...SIDES.flatMap((side) => [
          turned(box([side * 0.12, 0.2, 0.1], [0.12, 0.035, 0.03], trim), [0, 0, side * 0.8]),
          cone([side * 0.16, 0.26, 0.1], [0.03, 0.09, 0.03], trim)
        ])
      ]
    case 1:
      return SIDES.flatMap((side) => [
        turned(box([side * 0.14, 0.2, 0], [0.035, 0.22, 0.035], trim), [0, 0, -side * 0.3]),
        turned(box([side * 0.2, 0.23, 0], [0.12, 0.025, 0.025], trim), [0, 0, side * 0.45])
      ])
    case 2:
      return [-2, -1, 0, 1, 2].map((ray) =>
        turned(box([ray * 0.05, 0.2, 0.05], [0.055, 0.18, 0.035], trim), [0, 0, -ray * 0.3])
      )
    case 3:
      return [turned(cone([0, 0.21, 0.08], [0.09, 0.26, 0.09], trim), [0.3, 0, 0])]
    case 4:
      return [box([0, 0.1, 0], [0.36, 0.025, 0.32], trim)]
    case 5:
      return SIDES.map((side) =>
        turned(cone([side * 0.16, 0.16, 0], [0.075, 0.22, 0.08], trim), [0, 0, -side * 0.7])
      )
    case 6:
      return [box([0, 0.17, 0], [0.045, 0.22, 0.26], trim)]
    default:
      return SIDES.map((side) =>
        turned(box([side * 0.18, 0.07, 0], [0.18, 0.08, 0.16], trim), [0, 0, side * 0.35])
      )
  }
}

function backFitting(kind: number, trim: string): PartSpec[] {
  switch (kind) {
    case 0:
      return [
        cylinder([0.19, 0.73, -0.16], [0.025, 0.68, 0.025], EDO.ink),
        box([0.28, 0.98, -0.16], [0.18, 0.2, 0.025], trim)
      ]
    case 1:
      return [
        turned(box([0.14, 0.62, -0.18], [0.055, 0.63, 0.055], EDO.ink), [0, 0, -0.45]),
        turned(box([0.25, 0.86, -0.18], [0.17, 0.025, 0.07], trim), [0, 0, -0.45])
      ]
    default:
      return [
        box([-0.2, 0.84, -0.15], [0.035, 0.3, 0.035], EDO.ink),
        box([-0.27, 0.97, -0.15], [0.16, 0.03, 0.04], EDO.ink),
        cylinder([-0.33, 0.86, -0.15], [0.14, 0.18, 0.14], trim),
        cone([-0.33, 0.98, -0.15], [0.18, 0.07, 0.18], EDO.ink)
      ]
  }
}

export function samuraiParts({ agent, skin }: Pick<RobotModelProps, 'agent' | 'skin'>) {
  const variant = steamVariant(agent.agentKey)
  const joints = steamJoints({ skin }, EDO.ink)
  const size = BUILDS[variant.build]
  joints.body.push(
    box([0, 0.52, 0], size, skin.body),
    box([0, 0.53, size[2] / 2], [size[0] * 0.8, size[1] * 0.6, 0.035], skin.trim),
    ...[0, 1, 2].map((plate) =>
      box([0, 0.4 - plate * 0.045, 0.06], [size[0] * 0.9, 0.035, 0.2], skin.body)
    ),
    ...backFitting(variant.back, skin.trim)
  )
  for (const arm of [joints.leftArm, joints.rightArm]) {
    for (let plate = 0; plate < (variant.build === 1 ? 3 : 2); plate++)
      arm.push(
        box([0, -plate * 0.05, 0], [variant.build === 1 ? 0.2 : 0.13, 0.035, 0.22], skin.body)
      )
  }
  joints.head.push(
    sphere([0, 0, 0], [0.29, variant.headgear === 6 ? 0.25 : 0.21, 0.27], skin.body),
    box([0, -0.035, 0.13], [0.23, 0.11, 0.035], EDO.ink),
    ...SIDES.map((side) => box([side * 0.135, -0.06, -0.02], [0.04, 0.14, 0.2], skin.body)),
    ...crest(variant.headgear, skin.trim)
  )
  return { variant, joints }
}
