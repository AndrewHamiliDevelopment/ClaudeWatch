import type { FloorProps, ZoneProps } from '../types'
import { box, lit, Parts, type PartSpec } from '../parts'
import { CompanyGrounds, FloorSlab, LiftAt, ProjectRoom } from '../ZoneArchitecture'
import { paperLantern, timberArch } from './GroveRoom'
import { GROVE, GROVE_PALETTE } from './palette'
import { ball, tube } from './spirit-features'

// The company gate: a tall timber arch with a lantern on each side and ivy over the beam.
const GATE: PartSpec[] = [
  ...timberArch(1.6, 2.2),
  ...[-1, 1].flatMap((side) => paperLantern(side * 1.05, 1.55)),
  ball([-1.2, 2.34, 0], [0.9, 0.3, 0.5], GROVE.fern),
  ball([0.9, 2.36, 0], [1.2, 0.34, 0.5], GROVE.moss)
]

// A mossy meadow inside a low river-stone wall.
export function GroveCompanyZone({ zone }: ZoneProps) {
  return <CompanyGrounds zone={zone} palette={GROVE_PALETTE} gate={<Parts parts={GATE} />} />
}

// A clearing of dark earth inside a hedge.
export function GroveProjectOffice({ zone }: ZoneProps) {
  return <ProjectRoom zone={zone} palette={GROVE_PALETTE} />
}

// Floor-scoped parts: drawn only when Quiet Grove is the whole floor's theme.
export function GroveSlab({ floor }: FloorProps) {
  return <FloorSlab floor={floor} ground={GROVE.pine} lane={GROVE.bark} />
}

// The lift is a hollow trunk: a dark doorway on each side, a ring of lantern light and a crown.
const LIFT: PartSpec[] = [
  tube([0, 1.1, 0], [1.7, 2.2, 1.7], GROVE.bark),
  box([0, 0.7, 0], [0.7, 1.4, 1.74], GROVE.soil),
  box([0, 0.7, 0], [1.74, 1.4, 0.7], GROVE.soil),
  lit(tube([0, 1.62, 0], [1.76, 0.07, 1.76], GROVE.lumen)),
  ball([0, 2.7, 0], [2.7, 1.4, 2.7], GROVE.pine),
  ball([0.5, 3.2, 0.3], [1.6, 0.9, 1.6], GROVE.moss)
]

export function GroveElevator({ floor }: FloorProps) {
  return <LiftAt floor={floor} parts={LIFT} />
}
