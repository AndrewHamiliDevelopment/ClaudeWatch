import type { FloorProps, TowerProps } from '../types'
import { ThemeTower } from '../WorldArchitecture'
import { frameParts } from './frame-parts'
import { COURT, COURT_PALETTE } from './palette'
import { box, Parts, type PartSpec } from './Parts'
import { COURT_FRAMES } from './roster'

// A stepped keep: three shrinking tiers, a lit window band and a gold spire.
function keep(x: number, z: number, width: number, height: number): PartSpec[] {
  return [
    box([x, height * 0.3, z], [width, height * 0.6, width], COURT.slate),
    box([x, height * 0.72, z], [width * 0.72, height * 0.24, width * 0.72], COURT.ink),
    box([x, height * 0.92, z], [width * 0.46, height * 0.16, width * 0.46], COURT.violet),
    { ...box([x, height * 0.5, z], [width * 1.02, 0.12, width * 1.02], COURT.lumen), glow: true },
    {
      shape: 'cone',
      at: [x, height * 1.12, z],
      size: [width * 0.3, height * 0.24, width * 0.3],
      color: COURT.gold
    }
  ]
}

const SKYLINE: PartSpec[] = [
  box([0, -0.25, 0], [7, 0.2, 22], COURT.courtyard),
  ...keep(-1.5, -8, 2.2, 5),
  ...keep(1.2, -4, 1.8, 3.4),
  ...keep(-1, 0, 2.6, 6.5),
  ...keep(1.4, 4, 1.6, 3),
  ...keep(-1.4, 8, 2, 4.4)
]

export function CourtDistrict({ floor }: FloorProps) {
  return (
    <group position={[-floor.width / 2 - 5, 0, 0]}>
      <Parts parts={SKYLINE} />
    </group>
  )
}

const HANGAR_FRAME_SCALE = 1.5
const BAY_SPACING = 1.9

// The project hangar: one frame of each kind parked under a gantry.
const GANTRY: PartSpec[] = [
  box([0, -0.12, 0], [6.4, 0.2, 5], COURT.courtyard),
  ...[-3, 3].flatMap((x) => [-2.2, 2.2].map((z) => box([x, 2, z], [0.18, 4, 0.18], COURT.ink))),
  ...[-2.2, 2.2].map((z) => box([0, 4, z], [6.4, 0.22, 0.22], COURT.gold)),
  ...COURT_FRAMES.map((_, bay) =>
    box([(bay - 1) * BAY_SPACING, 0.02, 0], [1.5, 0.06, 1.3], COURT.slate)
  )
]

const HANGAR_FRAMES = COURT_FRAMES.map((frame) => ({ id: frame.id, parts: frameParts(frame.kind) }))

export function CourtHangar({ floor }: FloorProps) {
  return (
    <group position={[floor.width / 2 + 5.5, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
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
  )
}

export function CourtTower(props: TowerProps) {
  return <ThemeTower {...props} palette={COURT_PALETTE} />
}
