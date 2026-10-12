import type { FloorProps, TowerProps } from '../types'
import { box, Parts, turned, type PartSpec } from '../parts'
import { hangarStand } from '../violet-court/apron'
import { ApronFill, DISTRICT_SIDES, HANGAR_SIDES } from '../violet-court/LotFill'
import { ThemeTower } from '../WorldArchitecture'
import { GROVE_LOT_KIT } from './grove-lots'
import { paperLantern } from './GroveRoom'
import { GROVE, GROVE_PALETTE } from './palette'
import { ball, tube } from './spirit-features'

// The country beyond the clearing: ponds and rock gardens by the plate, then cabins and trees.
export function GroveDistrict({ floor }: FloorProps) {
  return <ApronFill floor={floor} kit={GROVE_LOT_KIT} sides={DISTRICT_SIDES} paving={GROVE.pine} />
}

const ROOF_PITCH = 0.5
const BED_ROWS = [-1.3, 0, 1.3]
const BED_SLOTS = [-2, -0.7, 0.7, 2]

// The project hangar is a greenhouse: a timber frame under a pitched glass roof, with three
// planter beds of seedlings waiting to be sent out.
const GREENHOUSE: PartSpec[] = [
  box([0, -0.26, 0], [6.4, 0.48, 5], GROVE.bark),
  ...[-3, 0, 3].flatMap((x) =>
    [-2.2, 2.2].map((z) => tube([x, 1.3, z], [0.16, 2.6, 0.16], GROVE.timber))
  ),
  ...[-2.2, 2.2].map((z) => box([0, 2.6, z], [6.4, 0.16, 0.2], GROVE.timber)),
  ...[-1, 1].map((side) =>
    turned(box([0, 3.2, side * 1.15], [6.2, 0.06, 2.6], GROVE.pond), [side * ROOF_PITCH, 0, 0])
  ),
  box([0, 3.82, 0], [6.4, 0.14, 0.18], GROVE.timber),
  ...BED_ROWS.flatMap((z) => [
    box([0, 0.2, z], [5.2, 0.4, 0.7], GROVE.timber),
    box([0, 0.41, z], [5, 0.02, 0.56], GROVE.soil),
    ...BED_SLOTS.flatMap((x) => [
      tube([x, 0.62, z], [0.06, 0.4, 0.06], GROVE.fern),
      ball([x, 0.9, z], [0.44, 0.36, 0.44], z === 0 ? GROVE.moss : GROVE.fern)
    ])
  ]),
  ...paperLantern(-3, 2.2, 2.5),
  ...paperLantern(3, 2.2, 2.5)
]

export function GroveHangar({ floor }: FloorProps) {
  const stand = hangarStand(floor)
  return (
    <>
      <ApronFill floor={floor} kit={GROVE_LOT_KIT} sides={HANGAR_SIDES} paving={GROVE.pine} />
      <group position={[stand.x, 0, stand.z]} rotation={[0, -Math.PI / 2, 0]}>
        <Parts parts={GREENHOUSE} />
      </group>
    </>
  )
}

export function GroveTower(props: TowerProps) {
  return <ThemeTower {...props} palette={GROVE_PALETTE} />
}
