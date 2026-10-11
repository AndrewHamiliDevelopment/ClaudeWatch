import type { LayoutMap, RoomLayout } from '../../office/sim/layout'
import type { AgentView, SessionRef } from '../../shared/office/types'
import type { FloorGeometry, RoomGeometry } from '../office/scene-model'

// The sim measures from the corridor's west end; the scene centres each plate on the origin.
const BAYS_PER_SIDE = 8
const BAY_SIZE = 6
const CORRIDOR_WIDTH = 1.5
const PLATE_WIDTH = BAYS_PER_SIDE * BAY_SIZE
const PLATE_DEPTH = CORRIDOR_WIDTH + 2 * BAY_SIZE
const X_OFFSET = PLATE_WIDTH / 2
const ROOM_CENTRE_Z = CORRIDOR_WIDTH / 2 + BAY_SIZE / 2

// Plate 0 keeps the project's floor id; further plates of a busy project get their own.
const plateFloorId = (floorId: string, plate: number): string =>
  plate === 0 ? floorId : `${floorId}~${plate}`

function toRoomGeometry(room: RoomLayout, labels: Map<string, string>): RoomGeometry {
  const door = room.slots.find((slot) => slot.id === 'door') ?? room.slots[0]
  const side = Math.sign(door.z) || 1
  return {
    id: room.id,
    sessionKey: room.sessionKey,
    x: door.x - X_OFFSET,
    z: side * ROOM_CENTRE_Z,
    width: BAY_SIZE,
    depth: BAY_SIZE,
    door: { x: door.x - X_OFFSET, z: door.z },
    label: room.sessionKey ? (labels.get(room.sessionKey) ?? '') : 'Team room',
    kind: room.kind === 'team' ? 'team' : 'office'
  }
}

export function toFloorGeometry(layout: LayoutMap, sessions: SessionRef[]): FloorGeometry[] {
  const labels = new Map(sessions.map((session) => [session.key, session.name]))
  return layout.floors.flatMap((floor) => {
    const plates = [...new Set(floor.rooms.map((room) => room.plate))].sort((a, b) => a - b)
    return (plates.length ? plates : [0]).map((plate) => ({
      floorId: plateFloorId(floor.id, plate),
      label: plate === 0 ? floor.label : `${floor.label} (${plate + 1})`,
      plate,
      width: PLATE_WIDTH,
      depth: PLATE_DEPTH,
      corridor: { z: 0, width: CORRIDOR_WIDTH },
      rooms: floor.rooms
        .filter((room) => room.plate === plate)
        .map((room) => toRoomGeometry(room, labels)),
      zones: [],
      elevator: { x: floor.elevator.x - X_OFFSET, z: floor.elevator.z }
    }))
  })
}

export function toSceneAgent(view: AgentView): AgentView {
  const plate = Number(view.roomId.split(':').at(-2)) || 0
  return { ...view, floorId: plateFloorId(view.floorId, plate), x: view.x - X_OFFSET }
}
