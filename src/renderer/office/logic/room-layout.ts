import type { RoomGeometry } from '../scene-model'

// Any centred rectangle with a door: rooms, and company or project zones.
export type DooredRect = Pick<RoomGeometry, 'x' | 'z' | 'width' | 'depth' | 'door'>
type WalledRect = DooredRect & Pick<RoomGeometry, 'id'>

export type WallSide = 'north' | 'south' | 'east' | 'west'
export type WallsMode = 'up' | 'cutaway' | 'down'

export interface DeskSlot {
  slotId: string
  x: number
  z: number
  // Yaw in radians; the character faces (sin heading, cos heading) on the XZ plane.
  heading: number
}

export interface WallSegment {
  roomId: string
  x: number
  z: number
  length: number
  normalX: number
  normalZ: number
}

// Low walls so the isometric view reads into every room; cutaway drops the near ones further.
export const WALL_HEIGHT_FULL = 1.3
export const WALL_HEIGHT_LOW = 0.25
export const DOOR_WIDTH = 1.1
// Distance from a seated agent to the centre of its desk.
export const DESK_REACH = 0.62
const MAX_GUEST_DESKS = 4
// Cosine above which a wall counts as facing the camera in cutaway.
const CUTAWAY_FACING_THRESHOLD = 0.2

// North is -z, south is +z, east is +x, west is -x; normals point out of the room.
const SIDE_NORMAL: Record<WallSide, { x: number; z: number }> = {
  north: { x: 0, z: -1 },
  south: { x: 0, z: 1 },
  east: { x: 1, z: 0 },
  west: { x: -1, z: 0 }
}

export function doorSide(room: DooredRect): WallSide {
  const distances: Record<WallSide, number> = {
    north: Math.abs(room.door.z - (room.z - room.depth / 2)),
    south: Math.abs(room.door.z - (room.z + room.depth / 2)),
    east: Math.abs(room.door.x - (room.x + room.width / 2)),
    west: Math.abs(room.door.x - (room.x - room.width / 2))
  }
  return (Object.keys(distances) as WallSide[]).reduce((best, side) =>
    distances[side] < distances[best] ? side : best
  )
}

// Room-local frame: `back` points from the door into the room, `across` is perpendicular.
function roomAxes(room: DooredRect): {
  back: { x: number; z: number }
  across: { x: number; z: number }
  span: number
  reach: number
} {
  const outward = SIDE_NORMAL[doorSide(room)]
  const back = { x: -outward.x, z: -outward.z }
  const isDoorOnZ = outward.z !== 0
  return {
    back,
    across: { x: back.z, z: -back.x },
    span: isDoorOnZ ? room.width : room.depth,
    reach: isDoorOnZ ? room.depth : room.width
  }
}

export function deskSlots(room: RoomGeometry): DeskSlot[] {
  const { back, across, span, reach } = roomAxes(room)
  const heading = Math.atan2(back.x, back.z)
  const place = (slotId: string, acrossOffset: number, backOffset: number): DeskSlot => ({
    slotId,
    x: room.x + across.x * acrossOffset + back.x * backOffset,
    z: room.z + across.z * acrossOffset + back.z * backOffset,
    heading
  })

  const guestCount = room.kind === 'team' ? MAX_GUEST_DESKS : Math.min(MAX_GUEST_DESKS, 2)
  const guestPositions = [
    [-span * 0.28, -reach * 0.08],
    [span * 0.28, -reach * 0.08],
    [-span * 0.28, -reach * 0.3],
    [span * 0.28, -reach * 0.3]
  ]
  return [
    place('desk-0', 0, reach * 0.12),
    ...guestPositions
      .slice(0, guestCount)
      .map(([acrossOffset, backOffset], index) =>
        place(`guest-${index + 1}`, acrossOffset, backOffset)
      )
  ]
}

const SIGN_WALL_OFFSET = 0.1

// The sign hangs just outside the door wall; rotationY turns its face toward the corridor.
export function doorSignPlacement(room: DooredRect): { x: number; z: number; rotationY: number } {
  const outward = SIDE_NORMAL[doorSide(room)]
  return {
    x: room.door.x + outward.x * SIGN_WALL_OFFSET,
    z: room.door.z + outward.z * SIGN_WALL_OFFSET,
    rotationY: Math.atan2(outward.x, outward.z)
  }
}

function sideSegment(room: WalledRect, side: WallSide, from: number, to: number): WallSegment {
  const normal = SIDE_NORMAL[side]
  const isAlongX = normal.z !== 0
  const middle = (from + to) / 2
  return {
    roomId: room.id,
    x: isAlongX ? middle : room.x + (normal.x * room.width) / 2,
    z: isAlongX ? room.z + (normal.z * room.depth) / 2 : middle,
    length: to - from,
    normalX: normal.x,
    normalZ: normal.z
  }
}

export function roomWallSegments(room: WalledRect, doorWidth = DOOR_WIDTH): WallSegment[] {
  const withDoor = doorSide(room)
  return (Object.keys(SIDE_NORMAL) as WallSide[]).flatMap((side) => {
    const isAlongX = SIDE_NORMAL[side].z !== 0
    const start = isAlongX ? room.x - room.width / 2 : room.z - room.depth / 2
    const end = isAlongX ? room.x + room.width / 2 : room.z + room.depth / 2
    if (side !== withDoor) return [sideSegment(room, side, start, end)]
    const doorCentre = isAlongX ? room.door.x : room.door.z
    return [
      sideSegment(room, side, start, doorCentre - doorWidth / 2),
      sideSegment(room, side, doorCentre + doorWidth / 2, end)
    ].filter((segment) => segment.length > 0.05)
  })
}

export function wallHeight(
  mode: WallsMode,
  segment: WallSegment,
  camera: { x: number; z: number }
): number {
  if (mode === 'up') return WALL_HEIGHT_FULL
  if (mode === 'down') return WALL_HEIGHT_LOW
  const toCameraX = camera.x - segment.x
  const toCameraZ = camera.z - segment.z
  const distance = Math.hypot(toCameraX, toCameraZ) || 1
  const facing = (segment.normalX * toCameraX + segment.normalZ * toCameraZ) / distance
  return facing > CUTAWAY_FACING_THRESHOLD ? WALL_HEIGHT_LOW : WALL_HEIGHT_FULL
}
