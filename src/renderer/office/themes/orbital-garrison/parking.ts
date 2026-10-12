import { inwardHeading, type DooredRect } from '../../logic/room-layout'

const CORNER_INSET = 0.75

// Against the door wall, in the corner away from the door: behind the crew, who sit with their
// backs to the door, and facing the same way they do.
export function parkingSpot(room: DooredRect): { x: number; z: number; heading: number } {
  const heading = inwardHeading(room)
  const toDoorWall = { x: -Math.sin(heading), z: -Math.cos(heading) }
  const alongWall = { x: Math.cos(heading), z: -Math.sin(heading) }
  const isDoorOnX = Math.abs(toDoorWall.x) > 0.5
  const back = (isDoorOnX ? room.width : room.depth) / 2 - CORNER_INSET
  const doorOffset = (room.door.x - room.x) * alongWall.x + (room.door.z - room.z) * alongWall.z
  const aside =
    ((isDoorOnX ? room.depth : room.width) / 2 - CORNER_INSET) * (doorOffset > 0 ? -1 : 1)
  return {
    x: room.x + toDoorWall.x * back + alongWall.x * aside,
    z: room.z + toDoorWall.z * back + alongWall.z * aside,
    heading
  }
}
