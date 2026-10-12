import { describe, expect, it } from 'vitest'
import type { DooredRect } from '../../logic/room-layout'
import { parkingSpot } from './parking'

const room = (door: DooredRect['door']): DooredRect => ({ x: 10, z: 20, width: 6, depth: 4, door })

describe('where a room parks its frame', () => {
  it.each([
    ['north', { x: 9, z: 18 }],
    ['south', { x: 11.5, z: 22 }],
    ['east', { x: 13, z: 20.5 }],
    ['west', { x: 7, z: 19 }]
  ])('stays inside a room whose door is on the %s wall', (_side, door) => {
    const spot = parkingSpot(room(door))
    expect(Math.abs(spot.x - 10)).toBeLessThan(3)
    expect(Math.abs(spot.z - 20)).toBeLessThan(2)
  })

  it('stands against the door wall, in the corner away from the door', () => {
    const spot = parkingSpot(room({ x: 9, z: 18 }))
    expect(spot.z).toBeLessThan(19)
    expect(spot.x).toBeGreaterThan(11)
    expect(parkingSpot(room({ x: 11, z: 18 })).x).toBeLessThan(9)
  })

  it('faces into the room, the way the seated crew face', () => {
    expect(parkingSpot(room({ x: 9, z: 18 })).heading).toBeCloseTo(0)
    expect(parkingSpot(room({ x: 13, z: 20.5 })).heading).toBeCloseTo(-Math.PI / 2)
  })
})
