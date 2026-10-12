import { useMemo } from 'react'
import type { LoungeGeometry } from '../../scene-model'
import { box, lit, Parts, SIDES, turned, type PartSpec, cylinder, sphere } from '../parts'
import type { Vector } from '../primitives'
import type { LoungeProps } from '../types'
import { paperLantern } from './GroveRoom'
import { GROVE } from './palette'
import { ON_ITS_SIDE } from './spirit-features'

const LENGTHWISE: Vector = [Math.PI / 2, 0, 0]

// A log to sit on, with a moss cushion: the same height as the stump stool at a desk.
const SEAT: PartSpec[] = [
  turned(cylinder([0, 0.15, -0.12], [0.3, 0.62, 0.3], GROVE.bark), ON_ITS_SIDE),
  sphere([0, 0.3, -0.12], [0.44, 0.08, 0.26], GROVE.moss)
]

const RING_STONES = 8
const RING_RADIUS = 0.6

// A fire in a ring of river stones, on a patch of bare earth.
function campfire(x: number, z: number): PartSpec[] {
  return [
    box([x, 0.025, z], [2, 0.02, 2], GROVE.soil),
    ...Array.from({ length: RING_STONES }, (_, index) => {
      const turn = (index / RING_STONES) * Math.PI * 2
      return sphere(
        [x + Math.cos(turn) * RING_RADIUS, 0.09, z + Math.sin(turn) * RING_RADIUS],
        [0.3, 0.18, 0.26],
        GROVE.stone
      )
    }),
    ...SIDES.map((side) =>
      turned(cylinder([x + side * 0.12, 0.2, z], [0.1, 0.56, 0.1], GROVE.bark), [0, 0, side * 0.6])
    ),
    turned(cylinder([x, 0.2, z + 0.1], [0.1, 0.56, 0.1], GROVE.bark), [0.6, 0, 0]),
    lit(sphere([x, 0.36, z], [0.34, 0.56, 0.34], GROVE.lumen)),
    lit(sphere([x + 0.1, 0.22, z - 0.08], [0.22, 0.3, 0.22], GROVE.lumen))
  ]
}

// A hammock slung between two posts, lengthwise so it stays clear of the last row of seats.
function hammock(x: number, z: number): PartSpec[] {
  return [
    ...SIDES.map((end) => cylinder([x, 0.6, z + end * 0.95], [0.1, 1.2, 0.1], GROVE.timber)),
    turned(cylinder([x, 0.58, z], [0.6, 1.7, 0.14], GROVE.paper), LENGTHWISE),
    sphere([x, 0.68, z - 0.55], [0.34, 0.12, 0.3], GROVE.fern)
  ]
}

// A stump table with two mugs, and a lantern on a post beside it.
function stumpTable(x: number, z: number): PartSpec[] {
  return [
    cylinder([x, 0.2, z], [0.56, 0.4, 0.56], GROVE.bark),
    cylinder([x, 0.415, z], [0.6, 0.03, 0.6], GROVE.timber),
    cylinder([x - 0.12, 0.48, z + 0.08], [0.08, 0.1, 0.08], GROVE.clay),
    cylinder([x + 0.14, 0.48, z - 0.06], [0.08, 0.1, 0.08], GROVE.clay),
    ...lanternPost(x, z + 0.8)
  ]
}

function lanternPost(x: number, z: number): PartSpec[] {
  return [cylinder([x, 0.6, z], [0.07, 1.2, 0.07], GROVE.timber), ...paperLantern(x, 1.3, z)]
}

const HEARTH_PAST_LAST_ROW = 1.75
const EDGE_INSET = 0.3

// Everything but the seats, in floor coordinates: past the last row and along the two side edges.
function loungeDecor(lounge: LoungeGeometry): PartSpec[] {
  const lastRow = Math.max(...lounge.seats.map((seat) => seat.z))
  const north = lounge.z - lounge.depth / 2
  const hearthZ = lastRow + HEARTH_PAST_LAST_ROW
  const edgeX = lounge.width / 2 - EDGE_INSET
  return [
    ...campfire(lounge.x, hearthZ),
    ...hammock(lounge.x + 2.2, hearthZ),
    ...stumpTable(lounge.x - 2.2, hearthZ - 0.3),
    ...SIDES.flatMap((side) => [
      ...lanternPost(lounge.x + side * edgeX, north + 0.4),
      sphere([lounge.x + side * edgeX, 0.2, lastRow + 0.1], [0.5, 0.4, 0.5], GROVE.fern)
    ])
  ]
}

// The grove's place to rest: log seats facing a campfire, with a hammock to one side.
export function GroveLounge({ lounge }: LoungeProps) {
  const decor = useMemo(() => loungeDecor(lounge), [lounge])
  return (
    <group>
      {lounge.seats.map((seat) => (
        <group
          key={seat.slotId}
          name="lounge-seat"
          position={[seat.x, 0, seat.z]}
          rotation={[0, seat.heading, 0]}
        >
          <Parts parts={SEAT} />
        </group>
      ))}
      <group name="lounge-decor">
        <Parts parts={decor} />
      </group>
    </group>
  )
}
