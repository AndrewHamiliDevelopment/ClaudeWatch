import { useMemo } from 'react'
import type { LoungeGeometry } from '../scene-model'
import { BrassBoiler } from './BrassRoomDressing'
import { firstClear, spotAt, type Footprint } from './lounge-layout'
import { BRASS } from './palettes'
import { box, Parts, type PartSpec } from './parts'
import type { LoungeProps } from './types'

// Copper and cream are the fence and wall colours the floor already draws, so they cost nothing.
const { wood, paper: cream, lacquer: copper } = BRASS
const BILLIARDS = { length: 1.7, reach: 0.95 }
const COUNTER = { length: 1.5, reach: 0.45 }
const STOVE_M = 0.6

const WALLS: readonly [number, number][] = [
  [0, 1],
  [-1, 1],
  [1, 1],
  [0, -1],
  [-1, -1],
  [1, -1]
]
const CORNERS: readonly [number, number][] = [
  [1, -1],
  [-1, -1],
  [1, 1],
  [-1, 1]
]

function billiardTable({ x, z, width, depth }: Footprint): PartSpec[] {
  return [
    ...[-1, 1].flatMap((dx) =>
      [-1, 1].map((dz) =>
        box(
          [x + dx * (width / 2 - 0.14), 0.26, z + dz * (depth / 2 - 0.14)],
          [0.14, 0.52, 0.14],
          wood
        )
      )
    ),
    box([x, 0.61, z], [width, 0.18, depth], copper),
    box([x, 0.705, z], [width - 0.22, 0.03, depth - 0.22], cream),
    box([x - 0.3, 0.74, z + 0.1], [0.07, 0.07, 0.07], copper),
    box([x + 0.2, 0.74, z - 0.15], [0.07, 0.07, 0.07], copper),
    box([x + 0.45, 0.735, z + 0.2], [0.5, 0.04, 0.04], wood)
  ]
}

// A serving counter with mugs on it.
function counter({ x, z, width, depth }: Footprint): PartSpec[] {
  return [
    box([x, 0.42, z], [width, 0.84, depth * 0.8], wood),
    box([x, 0.87, z], [width, 0.06, depth], copper),
    box([x - 0.4, 0.96, z], [0.12, 0.14, 0.12], cream),
    box([x + 0.3, 0.96, z], [0.12, 0.14, 0.12], cream)
  ]
}

interface CanteenPlan {
  table: Footprint | null
  stove: Footprint | null
  counter: Footprint | null
}

function planCanteen(lounge: LoungeGeometry): CanteenPlan {
  const table = firstClear(
    lounge,
    WALLS.map(([across, along]) => spotAt(lounge, across, along, BILLIARDS.length, BILLIARDS.reach))
  )
  const taken = table ? [table] : []
  const stove = firstClear(
    lounge,
    CORNERS.map(([across, along]) => spotAt(lounge, across, along, STOVE_M, STOVE_M)),
    taken
  )
  if (stove) taken.push(stove)
  const bar = firstClear(
    lounge,
    [...WALLS]
      .reverse()
      .map(([across, along]) => spotAt(lounge, across, along, COUNTER.length, COUNTER.reach)),
    taken
  )
  return { table, stove, counter: bar }
}

// A canteen floor: a stool at every seat, with a billiard table and a counter wherever no agent
// sits or walks in from the door.
export function brassLoungeParts(lounge: LoungeGeometry): PartSpec[] {
  const plan = planCanteen(lounge)
  return [
    box([lounge.x, 0.015, lounge.z], [lounge.width, 0.03, lounge.depth], wood),
    ...lounge.seats.flatMap((seat) => [
      box([seat.x, 0.07, seat.z], [0.34, 0.14, 0.34], wood),
      box([seat.x, 0.16, seat.z], [0.56, 0.06, 0.56], copper)
    ]),
    ...(plan.table ? billiardTable(plan.table) : []),
    ...(plan.counter ? counter(plan.counter) : [])
  ]
}

export function BrassLounge({ lounge }: LoungeProps) {
  const { stove } = useMemo(() => planCanteen(lounge), [lounge])
  const parts = useMemo(() => brassLoungeParts(lounge), [lounge])
  return (
    <>
      <Parts parts={parts} />
      {stove && (
        <group position={[stove.x, 0, stove.z]}>
          <BrassBoiler />
        </group>
      )}
    </>
  )
}
