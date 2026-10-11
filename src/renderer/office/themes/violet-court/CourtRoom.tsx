import { useMemo } from 'react'
import { DESK_REACH, doorSide, doorSignPlacement, inwardHeading } from '../../logic/room-layout'
import type { InstancePlacement } from '../../scene/instancing'
import { Batch } from '../primitives'
import type { DeskProps, RoomProps, RoomsProps } from '../types'
import { UNIT_SHAPES } from '../unit-parts'
import { frameParts } from './frame-parts'
import { COURT } from './palette'
import { box, Parts, turned, type PartSpec, lit } from '../parts'
import { frameForBay } from './roster'

const TILE = 0.75
const TILE_Y = 0.012

// A chessboard under every office, as two instanced tile colours.
export function CourtRoomFloors({ rooms }: RoomsProps) {
  const tiles = useMemo(() => {
    const light: InstancePlacement[] = []
    const dark: InstancePlacement[] = []
    for (const room of rooms) {
      const columns = Math.max(1, Math.round(room.width / TILE))
      const rows = Math.max(1, Math.round(room.depth / TILE))
      for (let column = 0; column < columns; column++)
        for (let row = 0; row < rows; row++)
          ((column + row) % 2 ? dark : light).push({
            x: room.x - room.width / 2 + ((column + 0.5) * room.width) / columns,
            y: TILE_Y,
            z: room.z - room.depth / 2 + ((row + 0.5) * room.depth) / rows,
            rotationY: 0,
            scaleX: room.width / columns,
            scaleY: 0.02,
            scaleZ: room.depth / rows
          })
    }
    return { light, dark }
  }, [rooms])
  return (
    <>
      <Batch color={COURT.marble} points={tiles.light}>
        {UNIT_SHAPES.box}
      </Batch>
      <Batch color={COURT.slate} points={tiles.dark}>
        {UNIT_SHAPES.box}
      </Batch>
    </>
  )
}

// Two posts and two rafters meeting in a point; the doorway and the company gate share it.
export function pointedArch(halfWidth: number, postHeight: number, rise: number): PartSpec[] {
  const rafter = Math.hypot(halfWidth, rise)
  const pitch = Math.atan2(rise, halfWidth)
  const thickness = halfWidth * 0.2
  return [-1, 1].flatMap((side) => [
    box([side * halfWidth, postHeight / 2, 0], [thickness, postHeight, thickness], COURT.ink),
    turned(
      box(
        [(side * halfWidth) / 2, postHeight + rise / 2, 0],
        [rafter + thickness, thickness * 0.8, thickness],
        COURT.gold
      ),
      [0, 0, -side * pitch]
    )
  ])
}

const DOOR_ARCH = pointedArch(0.58, 1.1, 0.34)

export function CourtDoorway({ room }: RoomProps) {
  const sign = doorSignPlacement(room)
  return (
    <group position={[room.door.x, 0, room.door.z]} rotation={[0, sign.rotationY, 0]}>
      <Parts parts={DOOR_ARCH} />
    </group>
  )
}

// A tactical table with a lit board and a screen, and a high-backed chair behind the pilot.
const DESK: PartSpec[] = [
  box([0, 0.23, DESK_REACH], [0.9, 0.46, 0.4], COURT.slate),
  box([0, 0.5, DESK_REACH], [1.2, 0.07, 0.6], COURT.ink),
  box([0, 0.5, DESK_REACH + 0.3], [1.22, 0.075, 0.03], COURT.gold),
  lit(box([0.3, 0.545, DESK_REACH], [0.42, 0.02, 0.36], COURT.lumen)),
  box([-0.32, 0.545, DESK_REACH - 0.16], [0.34, 0.02, 0.12], COURT.marble),
  box([-0.3, 0.7, DESK_REACH + 0.2], [0.5, 0.3, 0.03], COURT.ink),
  lit(box([-0.3, 0.7, DESK_REACH + 0.18], [0.44, 0.24, 0.01], COURT.lumen)),
  box([0, 0.4, -0.32], [0.5, 0.8, 0.06], COURT.violet),
  box([0, 0.83, -0.32], [0.56, 0.06, 0.08], COURT.gold)
]

export function CourtDesk({ slot }: DeskProps) {
  return (
    <group position={[slot.x, 0, slot.z]} rotation={[0, slot.heading, 0]}>
      <Parts parts={DESK} />
    </group>
  )
}

const FRAME_SCALE = 0.8
const PLINTH = [box([0, 0.03, 0], [0.8, 0.06, 0.6], COURT.slate)]
const CORNER_INSET = 0.7

// The pilot's knight frame, parked against the door wall: behind the pilots, who sit with
// their backs to the door, and facing the same way they do.
export function CourtRoomDressing({ room }: RoomProps) {
  const isDoorOnZ = ['north', 'south'].includes(doorSide(room))
  const heading = inwardHeading(room)
  const toDoorWall = (isDoorOnZ ? room.depth : room.width) / 2 - CORNER_INSET
  const toSideWall = (isDoorOnZ ? room.width : room.depth) / 2 - CORNER_INSET
  const doorOffset = isDoorOnZ ? room.door.x - room.x : room.door.z - room.z
  const awayFromDoor = doorOffset > 0 ? -toSideWall : toSideWall
  const x = room.x - Math.sin(heading) * toDoorWall + (isDoorOnZ ? awayFromDoor : 0)
  const z = room.z - Math.cos(heading) * toDoorWall + (isDoorOnZ ? 0 : awayFromDoor)
  const frame = useMemo(() => frameParts(frameForBay(room.bay).kind), [room.bay])
  return (
    <group position={[x, 0, z]} rotation={[0, heading, 0]}>
      <Parts parts={PLINTH} />
      <group position={[0, 0.06, 0]} scale={FRAME_SCALE}>
        <Parts parts={frame} />
      </group>
    </group>
  )
}
