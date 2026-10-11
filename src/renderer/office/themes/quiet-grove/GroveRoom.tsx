import { useMemo } from 'react'
import { DESK_REACH, doorSignPlacement, inwardHeading } from '../../logic/room-layout'
import type { InstancePlacement } from '../../scene/instancing'
import { Batch } from '../primitives'
import type { DeskProps, RoomProps, RoomsProps } from '../types'
import { UNIT_SHAPES } from '../unit-parts'
import { box, lit, Parts, type PartSpec } from '../parts'
import { GROVE } from './palette'
import { ball, tube } from './spirit-features'

const BOARD_WIDTH = 0.34
const BOARD_GAP = 0.03
const DECK_Y = 0.012

// Timber decking under every office: boards with a gap, so the dark ground reads between them.
export function GroveRoomFloors({ rooms }: RoomsProps) {
  const boards = useMemo(() => {
    const placements: InstancePlacement[] = []
    for (const room of rooms) {
      const rows = Math.max(1, Math.round(room.depth / BOARD_WIDTH))
      for (let row = 0; row < rows; row++)
        placements.push({
          x: room.x,
          y: DECK_Y,
          z: room.z - room.depth / 2 + ((row + 0.5) * room.depth) / rows,
          rotationY: 0,
          scaleX: room.width,
          scaleY: 0.02,
          scaleZ: room.depth / rows - BOARD_GAP
        })
    }
    return placements
  }, [rooms])
  return (
    <Batch color={GROVE.deck} points={boards}>
      {UNIT_SHAPES.box}
    </Batch>
  )
}

// A paper lantern on a bark cap; the doorway, the company gate and the lift all hang one.
export function paperLantern(x: number, y: number, z = 0): PartSpec[] {
  return [
    lit(ball([x, y, z], [0.2, 0.24, 0.2], GROVE.lumen)),
    tube([x, y + 0.14, z], [0.1, 0.04, 0.1], GROVE.bark)
  ]
}

// Two posts under a pair of beams; the doorway and the company gate share it.
export function timberArch(halfWidth: number, height: number): PartSpec[] {
  const post = halfWidth * 0.16
  return [
    ...[-1, 1].map((side) =>
      tube([side * halfWidth, height / 2, 0], [post, height, post], GROVE.timber)
    ),
    box([0, height, 0], [halfWidth * 2.5, post * 0.8, post * 1.4], GROVE.bark),
    box([0, height - post * 1.6, 0], [halfWidth * 2.1, post * 0.6, post], GROVE.timber)
  ]
}

const DOORWAY: PartSpec[] = [...timberArch(0.6, 1.3), ...paperLantern(0.34, 0.98)]

export function GroveDoorway({ room }: RoomProps) {
  const sign = doorSignPlacement(room)
  return (
    <group position={[room.door.x, 0, room.door.z]} rotation={[0, sign.rotationY, 0]}>
      <Parts parts={DOORWAY} />
    </group>
  )
}

const DESK_TOP_Y = 0.43
const SCREEN_X = -0.3
const SCREEN_Z = DESK_REACH + 0.16

// A low timber desk on two stumps: a glowing leaf for a screen, a slate to type on, a mug and a
// potted fern, with a stump stool under the worker.
const DESK: PartSpec[] = [
  box([0, DESK_TOP_Y, DESK_REACH], [1.2, 0.06, 0.58], GROVE.timber),
  ...[-0.42, 0.42].map((x) => tube([x, 0.2, DESK_REACH], [0.22, 0.4, 0.22], GROVE.bark)),
  tube([SCREEN_X, 0.53, SCREEN_Z], [0.035, 0.16, 0.035], GROVE.bark),
  lit(ball([SCREEN_X, 0.76, SCREEN_Z], [0.42, 0.32, 0.04], GROVE.lumen)),
  box([SCREEN_X, 0.76, SCREEN_Z], [0.015, 0.3, 0.05], GROVE.bark),
  box([0.02, DESK_TOP_Y + 0.04, DESK_REACH - 0.12], [0.36, 0.02, 0.15], GROVE.stone),
  tube([0.36, DESK_TOP_Y + 0.08, DESK_REACH - 0.06], [0.08, 0.1, 0.08], GROVE.clay),
  tube([0.42, DESK_TOP_Y + 0.08, DESK_REACH + 0.17], [0.12, 0.1, 0.12], GROVE.clay),
  ball([0.42, DESK_TOP_Y + 0.21, DESK_REACH + 0.17], [0.2, 0.18, 0.2], GROVE.fern),
  tube([0, 0.15, -0.12], [0.34, 0.3, 0.34], GROVE.bark),
  tube([0, 0.31, -0.12], [0.36, 0.03, 0.36], GROVE.timber)
]

export function GroveDesk({ slot }: DeskProps) {
  return (
    <group position={[slot.x, 0, slot.z]} rotation={[0, slot.heading, 0]}>
      <Parts parts={DESK} />
    </group>
  )
}

// A young tree in a planter with a mushroom lamp and two river stones at its foot.
const CORNER_GARDEN: PartSpec[] = [
  box([0, 0.15, 0], [0.62, 0.3, 0.62], GROVE.bark),
  box([0, 0.3, 0], [0.54, 0.02, 0.54], GROVE.soil),
  tube([0, 0.7, 0], [0.07, 0.8, 0.07], GROVE.bark),
  ball([0, 1.22, 0], [0.62, 0.5, 0.62], GROVE.moss),
  ball([0.16, 1.48, 0.06], [0.4, 0.34, 0.4], GROVE.fern),
  tube([0.5, 0.09, 0.22], [0.07, 0.18, 0.07], GROVE.paper),
  lit(ball([0.5, 0.2, 0.22], [0.24, 0.13, 0.24], GROVE.lumen)),
  ball([0.42, 0.05, -0.2], [0.24, 0.12, 0.2], GROVE.stone),
  ball([0.62, 0.04, -0.02], [0.15, 0.08, 0.14], GROVE.stone)
]
const CORNER_INSET = 0.72

// In the corner of the door wall away from the door: behind the workers, who sit with their
// backs to the door, so it never stands between a desk and the viewer.
export function GroveRoomDressing({ room }: RoomProps) {
  const heading = inwardHeading(room)
  const inward = { x: Math.sin(heading), z: Math.cos(heading) }
  const across = { x: inward.z, z: -inward.x }
  const isDoorOnZ = Math.abs(inward.z) > 0.5
  const toDoorWall = (isDoorOnZ ? room.depth : room.width) / 2 - CORNER_INSET
  const toSideWall = (isDoorOnZ ? room.width : room.depth) / 2 - CORNER_INSET
  const doorOffset = (room.door.x - room.x) * across.x + (room.door.z - room.z) * across.z
  const side = doorOffset > 0 ? -toSideWall : toSideWall
  return (
    <group
      position={[
        room.x - inward.x * toDoorWall + across.x * side,
        0,
        room.z - inward.z * toDoorWall + across.z * side
      ]}
      rotation={[0, heading, 0]}
    >
      <Parts parts={CORNER_GARDEN} />
    </group>
  )
}
