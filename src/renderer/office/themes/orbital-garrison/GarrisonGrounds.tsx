import type { FloorProps, ZoneProps } from '../types'
import { box, Parts, type PartSpec } from '../parts'
import { CompanyGrounds, ProjectRoom } from '../ZoneArchitecture'
import { GARRISON, GARRISON_PALETTE } from './palette'

const SIDES = [-1, 1] as const
const lit = (part: PartSpec): PartSpec => ({ ...part, glow: true })

// The company gate: a gantry truss on hazard footings, with a beacon over each post.
const GATE: PartSpec[] = [
  ...SIDES.flatMap((side) => [
    box([side * 1.7, 1.1, 0], [0.24, 2.2, 0.24], GARRISON.gunmetal),
    box([side * 1.7, 0.2, 0], [0.27, 0.4, 0.27], GARRISON.orange),
    lit(box([side * 1.7, 2.5, 0], [0.16, 0.14, 0.16], GARRISON.ice))
  ]),
  box([0, 2.3, 0], [3.9, 0.22, 0.3], GARRISON.steel),
  box([0, 2, 0], [3.64, 0.08, 0.12], GARRISON.steel)
]

export function GarrisonCompanyZone({ zone }: ZoneProps) {
  return <CompanyGrounds zone={zone} palette={GARRISON_PALETTE} gate={<Parts parts={GATE} />} />
}

export function GarrisonProjectOffice({ zone }: ZoneProps) {
  return <ProjectRoom zone={zone} palette={GARRISON_PALETTE} />
}

// Floor-scoped parts: drawn only when Orbital Garrison is the whole floor's theme.
export function GarrisonSlab({ floor }: FloorProps) {
  return (
    <Parts
      parts={[
        box([0, -0.16, 0], [floor.width + 1, 0.3, floor.depth + 1], GARRISON.hull),
        box(
          [0, -0.005, floor.corridor.z],
          [floor.width, 0.02, floor.corridor.width],
          GARRISON.deck
        ),
        box([0, 0, floor.corridor.z], [floor.width, 0.02, 0.1], GARRISON.orange)
      ]}
    />
  )
}

// A cargo lift: a hazard-edged platform between four posts.
const LIFT: PartSpec[] = [
  box([0, 0.05, 0], [2, 0.1, 2], GARRISON.gunmetal),
  ...SIDES.flatMap((side) => [
    box([0, 0.055, side * 0.95], [2, 0.11, 0.1], GARRISON.orange),
    box([0, 2, side * 0.9], [1.88, 0.08, 0.08], GARRISON.steel),
    ...SIDES.map((across) => box([across * 0.9, 1, side * 0.9], [0.08, 2, 0.08], GARRISON.steel))
  ]),
  lit(box([0, 2.02, 0], [0.3, 0.1, 0.3], GARRISON.ice))
]

export function GarrisonElevator({ floor }: FloorProps) {
  return (
    <group position={[floor.elevator.x, 0, floor.elevator.z]}>
      <Parts parts={LIFT} />
    </group>
  )
}
