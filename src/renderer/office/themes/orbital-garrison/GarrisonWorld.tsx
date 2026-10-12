import { useMemo } from 'react'
import { hangarStand } from '../apron'
import { GROUND_Y } from '../surroundings'
import type { FloorProps, TowerProps } from '../types'
import { box, Parts, turned, type PartSpec, lit, SIDES } from '../parts'
import { ThemeTower } from '../WorldArchitecture'
import { apronStrips, colonyStand, padLots } from './apron'
import { frameParts } from './frame-parts'
import { RadarDish } from './GarrisonAmbient'
import { PlacedParts } from './GarrisonSurroundings'
import { buildLot } from './lots'
import { GARRISON, GARRISON_PALETTE } from './palette'
import { GARRISON_FRAMES } from './roster'

// A colony habitat block: two lit window bands and a pale roof.
function habitat(x: number, z: number, width: number, height: number): PartSpec[] {
  return [
    box([x, height / 2, z], [width, height, width], GARRISON.gunmetal),
    ...[0.35, 0.7].map((level) =>
      lit(box([x, height * level, z], [width * 1.02, 0.1, width * 1.02], GARRISON.ice))
    ),
    box([x, height + 0.06, z], [width * 0.8, 0.12, width * 0.8], GARRISON.white)
  ]
}

// The docked carrier: a long hull in its cradle, an island bridge and two engine bells.
const CARRIER: PartSpec[] = [
  box([0, 0.5, 6.5], [1.4, 0.6, 5], GARRISON.hull),
  box([0, 1.3, 6.5], [2.4, 1.3, 6], GARRISON.steel),
  box([0, 1.3, 9.9], [1.4, 0.9, 1], GARRISON.steel),
  box([0, 1.96, 6.5], [0.3, 0.02, 5.6], GARRISON.orange),
  box([0.7, 2.5, 5.2], [0.8, 1.1, 1.4], GARRISON.white),
  lit(box([0.7, 2.7, 5.91], [0.7, 0.2, 0.02], GARRISON.ice)),
  ...SIDES.map(
    (side): PartSpec => ({
      shape: 'cylinder',
      at: [side * 0.6, 1.3, 3.4],
      size: [0.7, 0.5, 0.7],
      rotation: [Math.PI / 2, 0, 0],
      color: GARRISON.hull
    })
  )
]

const COLONY: PartSpec[] = [
  box([0, -0.25, 0], [7, 0.2, 22], GARRISON.deck),
  ...habitat(-1.6, -9, 2, 4.2),
  ...habitat(1.3, -6.5, 1.7, 2.8),
  ...habitat(-1.2, -3.5, 2.4, 5.6),
  ...habitat(1.5, -0.5, 1.6, 3.4),
  // The launch rail, climbing out over the habitats.
  turned(box([-2.6, 1.9, 4], [0.3, 0.16, 9], GARRISON.orange), [-0.18, 0, 0]),
  box([-2.6, 0.5, 1.5], [0.16, 1.2, 0.16], GARRISON.steel),
  box([-2.6, 1.1, 6.5], [0.16, 2.6, 0.16], GARRISON.steel),
  ...CARRIER
]

// The colony and its carrier to the west, and a working apron all the way round the plate: pads
// of yard buildings, a lit runway to the north and a hazard line at the plate's edge.
export function GarrisonDistrict({ floor }: FloorProps) {
  const apron = useMemo(() => {
    const builds = padLots(floor).map((lot) => buildLot(lot, GROUND_Y))
    return {
      parts: [...builds.flatMap((build) => build.parts), ...apronStrips(floor)],
      mounts: builds.flatMap((build) => build.mount ?? [])
    }
  }, [floor])
  return (
    <>
      <group position={[colonyStand(floor).x, 0, floor.z]}>
        <Parts parts={COLONY} />
      </group>
      <PlacedParts parts={apron.parts} />
      {/* The district is not told the motion setting, so its dishes stand still. */}
      {apron.mounts.map((mount) => (
        <RadarDish key={`${mount.x}:${mount.z}`} mount={mount} isReducedMotion />
      ))}
    </>
  )
}

const HANGAR_FRAME_SCALE = 1.5
const BAY_SPACING = 2.1

// The project hangar: one frame of each kind parked under a gantry.
const HANGAR_DECK: PartSpec[] = [
  box([0, -0.12, 0], [7, 0.2, 5], GARRISON.deck),
  ...SIDES.flatMap((side) => [
    box([0, 4.1, side * 2.2], [7, 0.24, 0.24], GARRISON.orange),
    ...SIDES.map((across) => box([across * 3.3, 2.05, side * 2.2], [0.2, 4.1, 0.2], GARRISON.steel))
  ]),
  ...GARRISON_FRAMES.flatMap((_, bay) => [
    box([(bay - 1) * BAY_SPACING, 0.02, 0], [1.7, 0.06, 1.5], GARRISON.gunmetal),
    box([(bay - 1) * BAY_SPACING, 0.025, 0.72], [1.7, 0.07, 0.08], GARRISON.orange)
  ])
]

const HANGAR_FRAMES = GARRISON_FRAMES.map((frame) => ({
  id: frame.id,
  parts: frameParts(frame.kind)
}))

export function GarrisonHangar({ floor }: FloorProps) {
  return (
    <group position={[hangarStand(floor).x, 0, floor.z]} rotation={[0, -Math.PI / 2, 0]}>
      <Parts parts={HANGAR_DECK} />
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

export function GarrisonTower(props: TowerProps) {
  return <ThemeTower {...props} palette={GARRISON_PALETTE} />
}
