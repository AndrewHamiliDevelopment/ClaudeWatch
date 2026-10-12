import { STEAM } from '../office-palette'
import { box, cone, cylinder, sphere, SIDES, turned, type PartSpec } from './parts'
import { steamJoints, steamVariant } from './steam-variant'
import type { RobotModelProps } from './types'

function headgear(kind: number, trim: string): PartSpec[] {
  switch (kind) {
    case 0:
      return [
        cylinder([0, 0.13, 0], [0.36, 0.035, 0.32], trim),
        cylinder([0, 0.23, 0], [0.23, 0.2, 0.23], trim)
      ]
    case 1:
      return [
        cylinder([0.07, 0.24, -0.025], [0.09, 0.28, 0.09], trim),
        cylinder([0.07, 0.38, -0.025], [0.14, 0.035, 0.14], STEAM.iron)
      ]
    case 2:
      return SIDES.map((side) =>
        turned(cylinder([side * 0.07, 0.08, 0.14], [0.12, 0.07, 0.12], trim), [Math.PI / 2, 0, 0])
      )
    case 3:
      return [
        sphere([0, 0.12, -0.02], [0.36, 0.17, 0.31], trim),
        box([0, 0.085, 0.12], [0.36, 0.025, 0.18], STEAM.iron)
      ]
    case 4:
      return SIDES.flatMap((side) => [
        cylinder([side * 0.11, 0.21, -0.06], [0.08, 0.23, 0.08], trim),
        cone([side * 0.11, 0.34, -0.06], [0.12, 0.06, 0.12], STEAM.iron)
      ])
    case 5:
      return [
        box([0, 0.22, 0], [0.025, 0.23, 0.025], trim),
        sphere([0, 0.35, 0], [0.09, 0.09, 0.09], trim),
        box([0, 0.27, 0], [0.28, 0.025, 0.025], trim)
      ]
    case 6:
      return [
        cylinder([0, 0.13, 0], [0.32, 0.035, 0.3], trim),
        ...SIDES.map((side) => box([side * 0.1, 0.22, 0], [0.035, 0.18, 0.035], trim)),
        cylinder([0, 0.32, 0], [0.25, 0.035, 0.25], trim)
      ]
    default:
      return [
        turned(cone([-0.07, 0.21, -0.03], [0.2, 0.23, 0.2], trim), [0, 0, Math.PI]),
        box([0.14, 0.08, 0], [0.09, 0.09, 0.25], trim)
      ]
  }
}

function machinery(kind: number, trim: string): PartSpec[] {
  switch (kind) {
    case 0:
      return [
        cylinder([-0.19, 0.64, -0.15], [0.075, 0.48, 0.075], STEAM.iron),
        cylinder([-0.19, 0.89, -0.15], [0.12, 0.04, 0.12], trim)
      ]
    case 1:
      return [
        box([0, 0.5, -0.16], [0.34, 0.29, 0.12], trim),
        ...SIDES.map((side) =>
          turned(cylinder([side * 0.23, 0.56, -0.15], [0.16, 0.045, 0.16], STEAM.iron), [
            0,
            0,
            Math.PI / 2
          ])
        )
      ]
    default:
      return SIDES.map((side) => cylinder([side * 0.17, 0.55, -0.13], [0.13, 0.32, 0.13], trim))
  }
}

export function brassParts({ agent, skin }: Pick<RobotModelProps, 'agent' | 'skin'>) {
  const variant = steamVariant(agent.agentKey)
  const joints = steamJoints({ skin }, STEAM.iron)
  if (variant.build === 0) {
    joints.body.push(
      cylinder([0, 0.51, 0], [0.32, 0.36, 0.25], skin.body),
      sphere([0, 0.67, 0], [0.32, 0.1, 0.25], skin.body)
    )
  } else if (variant.build === 1) {
    joints.body.push(
      box([0, 0.5, 0], [0.4, 0.28, 0.26], skin.body),
      box([0, 0.48, 0.14], [0.23, 0.12, 0.025], STEAM.iron)
    )
    joints.base = SIDES.map((side) =>
      box([side * 0.13, 0.075, 0.02], [0.19, 0.1, 0.24], STEAM.iron)
    )
  } else {
    joints.body.push(
      box([0, 0.53, 0], [0.19, 0.4, 0.16], skin.body),
      ...SIDES.map((side) => cylinder([side * 0.12, 0.53, 0], [0.045, 0.42, 0.045], skin.trim))
    )
    joints.legs = SIDES.map((side) =>
      cylinder([side * 0.1, 0.25, 0], [0.055, 0.25, 0.055], skin.body)
    )
  }
  joints.body.push(
    ...[0.42, 0.52, 0.62].map((height) =>
      sphere([0, height, 0.145], [0.035, 0.035, 0.025], skin.trim)
    ),
    ...machinery(variant.back, skin.trim)
  )
  for (const arm of [joints.leftArm, joints.rightArm])
    arm.push(sphere([0, 0, 0], [variant.build === 1 ? 0.17 : 0.11, 0.12, 0.13], skin.body))
  joints.head.push(
    ...(variant.headgear === 6
      ? [box([0, 0, 0], [0.25, 0.19, 0.23], skin.body)]
      : [sphere([0, 0, 0], [0.3, 0.22, 0.27], skin.body)]),
    ...headgear(variant.headgear, skin.trim)
  )
  return { variant, joints }
}
