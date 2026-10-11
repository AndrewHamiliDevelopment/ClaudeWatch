import type { Vector } from '../primitives'
import type { FloorProps, TowerProps } from '../types'
import { box, Parts, turned, type PartSpec } from '../violet-court/Parts'
import { ThemeTower } from '../WorldArchitecture'
import { paperLantern } from './GroveRoom'
import { GROVE, GROVE_PALETTE } from './palette'
import { ball, spike, tube } from './spirit-features'

// A pine: a trunk and three stacked cones.
function pine(x: number, z: number, height: number): PartSpec[] {
  return [
    tube([x, height * 0.15, z], [height * 0.08, height * 0.3, height * 0.08], GROVE.bark),
    ...[0, 1, 2].map((tier) => {
      const width = height * (0.5 - tier * 0.12)
      return spike([x, height * (0.42 + tier * 0.22), z], [width, height * 0.36, width], GROVE.pine)
    })
  ]
}

const STEPPING_STONES: Vector[] = [
  [-0.4, -0.1, 2],
  [0.3, -0.1, 2.9],
  [0.9, -0.1, 3.9],
  [0.5, -0.1, 4.9]
]

// The country beyond the clearing: rounded hills, a stream into a pond with stepping stones,
// pines, and a lantern on the bank.
const COUNTRYSIDE: PartSpec[] = [
  box([0, -0.25, 0], [7, 0.2, 22], GROVE.pine),
  ball([-1.6, -0.2, -7], [5, 3.2, 6.5], GROVE.moss),
  ball([-2, -0.2, 7.5], [4.4, 2.4, 5.5], GROVE.moss),
  ball([-0.4, -0.2, -2.2], [3.2, 1.5, 3.6], GROVE.fern),
  box([0.4, -0.13, -3], [0.7, 0.05, 9], GROVE.pond),
  tube([0.5, -0.13, 3.4], [4.2, 0.06, 5.4], GROVE.pond),
  ...STEPPING_STONES.map((at) => ball(at, [0.6, 0.16, 0.5], GROVE.stone)),
  ...pine(1.9, -8.5, 3.4),
  ...pine(2.4, -6.6, 2.4),
  ...pine(-2.3, 2.2, 3),
  ...pine(2.3, 8.6, 3.6),
  ...pine(1.2, 9.8, 2.2),
  tube([2.2, 0.5, 1.2], [0.07, 1.2, 0.07], GROVE.bark),
  ...paperLantern(2.2, 1.2, 1.2)
]

export function GroveDistrict({ floor }: FloorProps) {
  return (
    <group position={[-floor.width / 2 - 5, 0, 0]}>
      <Parts parts={COUNTRYSIDE} />
    </group>
  )
}

const ROOF_PITCH = 0.5
const BED_ROWS = [-1.3, 0, 1.3]
const BED_SLOTS = [-2, -0.7, 0.7, 2]

// The project hangar is a greenhouse: a timber frame under a pitched glass roof, with three
// planter beds of seedlings waiting to be sent out.
const GREENHOUSE: PartSpec[] = [
  box([0, -0.12, 0], [6.4, 0.2, 5], GROVE.bark),
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
  return (
    <group position={[floor.width / 2 + 5.5, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
      <Parts parts={GREENHOUSE} />
    </group>
  )
}

export function GroveTower(props: TowerProps) {
  return <ThemeTower {...props} palette={GROVE_PALETTE} />
}
