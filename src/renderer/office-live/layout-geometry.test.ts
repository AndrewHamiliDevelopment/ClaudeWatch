import { describe, it, expect } from 'vitest'
import { buildLayout } from '../../office/sim/layout'
import { session } from '../../office/sim/fixtures'
import { placements } from '../../office/sim/placements'
import { toFloorGeometry } from './layout-geometry'
import type { AgentView } from '../../shared/office/types'
import { DESK_REACH } from '../office/logic/room-layout'
import type { DeskSlot } from '../office/scene-model'

const sessions = [
  session('a'),
  session('b'),
  { ...session('c', 'p_b'), companyKey: 'c_second', companyLabel: 'Second' }
]

describe('headquarters geometry', () => {
  it('nests company > project > office/team and flattens precisely the leaves', () => {
    const worker = (id: string) => ({ id, type: 'worker', activity: 'reading' as const })
    // Three subagents: two sit at their lead's guest desks, the third needs a team area.
    const crowded = [
      { ...sessions[0], subagents: ['0', '1', '2'].map(worker) },
      ...sessions.slice(1)
    ]
    const layout = buildLayout(crowded, undefined)
    const floors = toFloorGeometry(layout, crowded)
    expect(floors).toHaveLength(1)
    const floor = floors[0]
    expect(floor.floorId).toBe('hq')
    expect(floor.zones.map((z) => z.label)).toEqual(['Second', 'Work'])
    for (const company of floor.zones) {
      expect(company.kind).toBe('company')
      for (const project of company.children) {
        expect(project.kind).toBe('project')
        // Only a project with subagents has a team area.
        expect(project.children.some((z) => z.kind === 'team')).toBe(project.projectKey === 'p_a')
        for (const leaf of project.children) {
          expect(floor.rooms.find((r) => r.id === leaf.id)).toMatchObject({
            x: leaf.x,
            z: leaf.z,
            door: leaf.door,
            label: leaf.label
          })
          expect(leaf.children).toEqual([])
        }
      }
    }
    expect(floor.rooms.map((room) => room.kind)).toEqual(['office', 'office', 'office', 'team'])
  })
  it('carries each office bay from the sim and gives a team room none', () => {
    const layout = buildLayout(sessions, undefined)
    const rooms = toFloorGeometry(layout, sessions)[0].rooms
    for (const room of rooms) {
      const simRoom = layout.floors[0].rooms.find((candidate) => candidate.id === room.id)
      expect(room.bay).toBe(room.kind === 'office' ? simRoom?.bay : undefined)
    }
    expect(rooms.filter((room) => room.kind === 'office').map((room) => room.bay)).toContain(1)
  })
  it('carries each company lounge on its zone, with the seats the sim made and no desk room', () => {
    const layout = buildLayout(sessions, undefined)
    const floor = toFloorGeometry(layout, sessions)[0]
    for (const [index, company] of floor.zones.entries()) {
      const lounge = layout.floors[0].zones[index].lounge!
      expect(company.lounge).toEqual({
        id: `${company.id}:lounge`,
        x: lounge.x,
        z: lounge.z,
        width: lounge.width,
        depth: lounge.depth,
        door: lounge.door,
        seats: lounge.slots.map((slot) => ({
          slotId: slot.id,
          x: slot.x,
          z: slot.z,
          heading: slot.heading
        }))
      })
      expect(company.lounge!.seats.map((seat) => seat.slotId)).toEqual(
        ['0', '1', '2', '3'].map((seat) => `lounge_seat_${seat}`)
      )
      for (const project of company.children) expect(project.lounge).toBeUndefined()
    }
    expect(floor.rooms.map((room) => room.kind)).toEqual(['office', 'office', 'office'])
  })
  it('uses the same gate-anchored metre frame for the plate, zones, leaves and agents', () => {
    const layout = buildLayout(sessions, undefined)
    const floor = toFloorGeometry(layout, sessions)[0]
    expect(floor.corridor).toEqual({ z: 0, width: 3 })
    expect(floor.elevator).toEqual({ x: 0, z: 0 })
    // The plate carries its own centre from the sim; the gate is not in the middle of it.
    const plate = { x: layout.floors[0].x, z: layout.floors[0].z }
    expect({ x: floor.x, z: floor.z }).toEqual(plate)
    expect(plate.x).not.toBe(0)
    for (const zone of floor.zones) {
      expect(Math.abs(zone.x - plate.x) + zone.width / 2).toBeLessThanOrEqual(floor.width / 2)
      expect(Math.abs(zone.z - plate.z) + zone.depth / 2).toBeLessThanOrEqual(floor.depth / 2)
    }
    for (const placement of placements(sessions, layout)) {
      const agent: AgentView = {
        ...placement.slot,
        agentKey: placement.session.key,
        floorId: placement.floorId,
        roomId: placement.room.id,
        slotId: placement.slot.id,
        activity: 'idle',
        attention: 'none',
        provider: 'claude',
        isSubagent: false,
        label: placement.session.name
      }
      const room = floor.rooms.find((r) => r.id === agent.roomId)!
      expect(Math.abs(agent.x - room.x)).toBeLessThan(room.width / 2)
      expect(Math.abs(agent.z - room.z)).toBeLessThan(room.depth / 2)
    }
  })
})

// Ground rectangle of the 1.2 × 0.65 m desk the scene draws in front of a seat.
function deskFootprint(seat: DeskSlot) {
  const sin = Math.sin(seat.heading)
  const cos = Math.cos(seat.heading)
  const halfX = Math.abs(sin) * 0.325 + Math.abs(cos) * 0.6
  const halfZ = Math.abs(cos) * 0.325 + Math.abs(sin) * 0.6
  const x = seat.x + sin * DESK_REACH
  const z = seat.z + cos * DESK_REACH
  return { minX: x - halfX, maxX: x + halfX, minZ: z - halfZ, maxZ: z + halfZ }
}

it('seats every agent behind its own desk, inside the room and facing the default camera', () => {
  const worker = (id: string) => ({ id, type: 'worker', activity: 'reading' as const })
  const crowded = [
    { ...session('a'), subagents: ['0', '1', '2', '3', '4'].map(worker) },
    session('b')
  ]
  const layout = buildLayout(crowded, undefined)
  const floor = toFloorGeometry(layout, crowded)[0]

  for (const { room, slot } of placements(crowded, layout)) {
    const seats = floor.rooms.find((r) => r.id === room.id)!.seats
    // The robot stands exactly where the scene draws its seat, turned the same way.
    expect(seats.find((seat) => seat.slotId === slot.id)).toEqual({
      slotId: slot.id,
      x: slot.x,
      z: slot.z,
      heading: slot.heading
    })
  }
  const ROBOT_RADIUS = 0.3
  for (const room of floor.rooms) {
    expect(room.seats.length).toBeGreaterThan(0)
    const desks = room.seats.map(deskFootprint)
    for (const [index, seat] of room.seats.entries()) {
      // The default camera sits at +x, +z: a robot facing that quarter shows its face.
      expect(Math.sin(seat.heading) + Math.cos(seat.heading)).toBeGreaterThan(0.5)
      const desk = desks[index]
      expect(desk.minX).toBeGreaterThan(room.x - room.width / 2)
      expect(desk.maxX).toBeLessThan(room.x + room.width / 2)
      expect(desk.minZ).toBeGreaterThan(room.z - room.depth / 2)
      expect(desk.maxZ).toBeLessThan(room.z + room.depth / 2)
      for (const [other, otherSeat] of room.seats.entries()) {
        if (other === index) continue
        const isRobotInDesk =
          otherSeat.x > desk.minX - ROBOT_RADIUS &&
          otherSeat.x < desk.maxX + ROBOT_RADIUS &&
          otherSeat.z > desk.minZ - ROBOT_RADIUS &&
          otherSeat.z < desk.maxZ + ROBOT_RADIUS
        const isDeskOverlap =
          desk.minX < desks[other].maxX &&
          desk.maxX > desks[other].minX &&
          desk.minZ < desks[other].maxZ &&
          desk.maxZ > desks[other].minZ
        expect({
          room: room.id,
          seat: seat.slotId,
          other: otherSeat.slotId,
          isRobotInDesk,
          isDeskOverlap
        }).toEqual({
          room: room.id,
          seat: seat.slotId,
          other: otherSeat.slotId,
          isRobotInDesk: false,
          isDeskOverlap: false
        })
      }
    }
  }
})

it('provides one empty headquarters floor before any sessions arrive', () => {
  const floors = toFloorGeometry({ version: 1, floors: [], reservations: {} }, [])
  expect(floors).toHaveLength(1)
  expect(floors[0]).toMatchObject({ floorId: 'hq', rooms: [], zones: [] })
})

it('draws an empty headquarters for a layout saved by the old floor-per-project version', () => {
  const old = {
    version: 1,
    floors: [
      { id: 'p_old', label: 'Old', width: 24, depth: 18, rooms: [], elevator: { x: 0, z: 0 } }
    ],
    reservations: {}
  } as unknown as Parameters<typeof toFloorGeometry>[0]
  expect(toFloorGeometry(old, [])).toMatchObject([{ floorId: 'hq', rooms: [], zones: [] }])
})
