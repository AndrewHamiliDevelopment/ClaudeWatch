import type { FloorProps, ZoneProps } from '../types'
import { CompanyGrounds, FloorSlab, LiftAt, ProjectRoom } from '../ZoneArchitecture'
import { pointedArch } from './CourtRoom'
import { COURT, COURT_PALETTE } from './palette'
import { box, Parts, type PartSpec } from '../parts'

// The company gate: a tall pointed arch with a violet banner on each post.
const GATE: PartSpec[] = [
  ...pointedArch(1.6, 2, 0.9),
  ...[-1, 1].flatMap((side) => [
    box([side * 1.6, 1.25, 0.18], [0.5, 1.1, 0.03], COURT.violet),
    box([side * 1.6, 1.83, 0.18], [0.58, 0.06, 0.05], COURT.gold)
  ])
]

export function CourtCompanyZone({ zone }: ZoneProps) {
  return <CompanyGrounds zone={zone} palette={COURT_PALETTE} gate={<Parts parts={GATE} />} />
}

export function CourtProjectOffice({ zone }: ZoneProps) {
  return <ProjectRoom zone={zone} palette={COURT_PALETTE} />
}

// Floor-scoped parts: drawn only when Violet Court is the whole floor's theme.
export function CourtSlab({ floor }: FloorProps) {
  return <FloorSlab floor={floor} ground={COURT.slate} lane={COURT.violet} />
}

// An open lift platform between four posts, under a violet canopy.
const LIFT: PartSpec[] = [
  box([0, 0.04, 0], [1.8, 0.08, 1.8], COURT.gold),
  ...[-0.8, 0.8].flatMap((x) => [-0.8, 0.8].map((z) => box([x, 1, z], [0.09, 2, 0.09], COURT.ink))),
  box([0, 2.05, 0], [2, 0.14, 2], COURT.violet),
  { shape: 'sphere', at: [0, 1.82, 0], size: [0.3, 0.3, 0.3], color: COURT.lumen, glow: true }
]

export function CourtElevator({ floor }: FloorProps) {
  return <LiftAt floor={floor} parts={LIFT} />
}
