import type { FloorProps, TowerProps } from '../types'
import { ThemeTower } from '../WorldArchitecture'
import { frameParts } from './frame-parts'
import { COURT, COURT_PALETTE } from './palette'
import { box, Parts, type PartSpec } from '../parts'
import { hangarStand } from './apron'
import { COURT_LOT_KIT } from './court-lots'
import { ApronFill, DISTRICT_SIDES, HANGAR_SIDES } from './LotFill'
import { COURT_FRAMES } from './roster'

// The palace grounds on the apron: paving, gardens by the plate and towers further out.
export function CourtDistrict({ floor }: FloorProps) {
  return <ApronFill floor={floor} kit={COURT_LOT_KIT} sides={DISTRICT_SIDES} paving={COURT.deck} />
}

const HANGAR_FRAME_SCALE = 1.5
const BAY_SPACING = 1.9

// The project hangar: one frame of each kind parked under a gantry.
const GANTRY: PartSpec[] = [
  box([0, -0.26, 0], [6.4, 0.48, 5], COURT.slate),
  ...[-3, 3].flatMap((x) => [-2.2, 2.2].map((z) => box([x, 2, z], [0.18, 4, 0.18], COURT.ink))),
  ...[-2.2, 2.2].map((z) => box([0, 4, z], [6.4, 0.22, 0.22], COURT.gold)),
  ...COURT_FRAMES.map((_, bay) =>
    box([(bay - 1) * BAY_SPACING, 0.02, 0], [1.5, 0.06, 1.3], COURT.slate)
  )
]

const HANGAR_FRAMES = COURT_FRAMES.map((frame) => ({ id: frame.id, parts: frameParts(frame.kind) }))

export function CourtHangar({ floor }: FloorProps) {
  const stand = hangarStand(floor)
  return (
    <>
      <ApronFill floor={floor} kit={COURT_LOT_KIT} sides={HANGAR_SIDES} paving={COURT.deck} />
      <group position={[stand.x, 0, stand.z]} rotation={[0, -Math.PI / 2, 0]}>
        <Parts parts={GANTRY} />
        {HANGAR_FRAMES.map((frame, bay) => (
          <group
            key={frame.id}
            position={[(bay - 1) * BAY_SPACING, 0.05, 0]}
            scale={HANGAR_FRAME_SCALE}
          >
            <Parts parts={frame.parts} />
          </group>
        ))}
      </group>
    </>
  )
}

export function CourtTower(props: TowerProps) {
  return <ThemeTower {...props} palette={COURT_PALETTE} />
}
