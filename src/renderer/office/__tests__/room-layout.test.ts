import { describe, expect, it } from 'vitest'
import {
  deskSlots,
  doorSide,
  doorSignPlacement,
  roomWallSegments,
  wallHeight,
  WALL_HEIGHT_FULL,
  WALL_HEIGHT_LOW
} from '../logic/room-layout'
import { makeRoom } from './fixtures'

// Room centred at (0,-4), 6 m wide, 5 m deep, door on its south wall (z = -1.5) facing the corridor.
const room = makeRoom({ id: 'r1', x: 0, z: -4, width: 6, depth: 5, door: { x: 0, z: -1.5 } })

describe('doorSide', () => {
  it('finds the wall the door sits on', () => {
    expect(doorSide(room)).toBe('south')
    expect(doorSide(makeRoom({ id: 'r2', x: 0, z: 4, door: { x: 0, z: 1.5 } }))).toBe('north')
  })
})

describe('deskSlots', () => {
  it('puts the main desk first and keeps every slot inside the room', () => {
    const slots = deskSlots(room)
    expect(slots[0].slotId).toBe('desk-0')
    expect(slots.length).toBeGreaterThanOrEqual(3)
    for (const slot of slots) {
      expect(Math.abs(slot.x - room.x)).toBeLessThan(room.width / 2)
      expect(Math.abs(slot.z - room.z)).toBeLessThan(room.depth / 2)
    }
  })

  it('seats people facing away from the door, toward their desk', () => {
    const [main] = deskSlots(room)
    // Door is south (+z side); facing away means facing -z, heading = PI.
    expect(Math.abs(Math.cos(main.heading) - -1)).toBeLessThan(1e-6)
  })
})

describe('doorSignPlacement', () => {
  it('hangs the sign on the corridor side of the door, facing the corridor', () => {
    const southDoor = doorSignPlacement(room)
    expect(southDoor.z).toBeGreaterThan(room.door.z)
    expect(southDoor.rotationY).toBeCloseTo(0)
    const northDoor = doorSignPlacement(makeRoom({ id: 'r2', x: 0, z: 4, door: { x: 0, z: 1.5 } }))
    expect(northDoor.z).toBeLessThan(1.5)
    expect(Math.abs(northDoor.rotationY)).toBeCloseTo(Math.PI)
  })
})

describe('roomWallSegments', () => {
  it('splits the door wall around a gap and keeps the other three whole', () => {
    const segments = roomWallSegments(room)
    expect(segments).toHaveLength(5)
    const doorWallLength = segments
      .filter((segment) => segment.normalZ === 1)
      .reduce((sum, segment) => sum + segment.length, 0)
    expect(doorWallLength).toBeCloseTo(room.width - 1.1)
  })
})

describe('wallHeight', () => {
  const southWall = roomWallSegments(room).find((segment) => segment.normalZ === 1)
  const northWall = roomWallSegments(room).find((segment) => segment.normalZ === -1)

  it('keeps every wall up in Up mode and low in Down mode', () => {
    expect(southWall && wallHeight('up', southWall, { x: 0, z: 30 })).toBe(WALL_HEIGHT_FULL)
    expect(northWall && wallHeight('down', northWall, { x: 0, z: 30 })).toBe(WALL_HEIGHT_LOW)
  })

  it('lowers only the walls facing the camera in Cutaway mode', () => {
    expect(southWall && wallHeight('cutaway', southWall, { x: 0, z: 30 })).toBe(WALL_HEIGHT_LOW)
    expect(northWall && wallHeight('cutaway', northWall, { x: 0, z: 30 })).toBe(WALL_HEIGHT_FULL)
  })
})
