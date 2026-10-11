import type { AgentView, SessionRef } from '../../../shared/office/types'
import { deskSlots } from '../logic/room-layout'
import type { FloorGeometry, RoomGeometry } from '../scene-model'

// Preview-only layout: two rows of offices either side of a corridor, lobby + lift at the west end.
// Phase 6 replaces this with the sim's LayoutMap.
const ROOM_WIDTH = 6
const ROOM_DEPTH = 5
const CORRIDOR_WIDTH = 3
const LOBBY_WIDTH = 4
const TEAM_ROOM_SUBAGENTS = 3

function roomFor(
  session: SessionRef,
  index: number,
  floorId: string,
  originX: number
): RoomGeometry {
  const column = Math.floor(index / 2)
  const side = index % 2 === 0 ? -1 : 1
  const x = originX + LOBBY_WIDTH + column * ROOM_WIDTH + ROOM_WIDTH / 2
  return {
    id: `${floorId}:room:${index}`,
    sessionKey: session.key,
    x,
    z: side * (CORRIDOR_WIDTH / 2 + ROOM_DEPTH / 2),
    width: ROOM_WIDTH,
    depth: ROOM_DEPTH,
    door: { x, z: (side * CORRIDOR_WIDTH) / 2 },
    label: session.name,
    kind: session.subagents.length >= TEAM_ROOM_SUBAGENTS ? 'team' : 'office'
  }
}

export function layoutFloor(options: {
  floorId: string
  label: string
  plate: number
  sessions: readonly SessionRef[]
}): FloorGeometry {
  const columns = Math.max(1, Math.ceil(options.sessions.length / 2))
  const width = LOBBY_WIDTH + columns * ROOM_WIDTH
  const originX = -width / 2
  return {
    floorId: options.floorId,
    label: options.label,
    plate: options.plate,
    width,
    depth: CORRIDOR_WIDTH + 2 * ROOM_DEPTH,
    corridor: { z: 0, width: CORRIDOR_WIDTH },
    rooms: options.sessions.map((session, index) =>
      roomFor(session, index, options.floorId, originX)
    ),
    zones: [],
    elevator: { x: originX + LOBBY_WIDTH / 2, z: -(CORRIDOR_WIDTH / 2 + ROOM_DEPTH / 2) }
  }
}

export function agentsForFloor(floor: FloorGeometry, sessions: readonly SessionRef[]): AgentView[] {
  return floor.rooms.flatMap((room) => {
    const session = sessions.find((candidate) => candidate.key === room.sessionKey)
    if (!session) return []
    const [mainDesk, ...guestDesks] = deskSlots(room)
    const base = { floorId: floor.floorId, roomId: room.id, provider: session.provider }
    const main: AgentView = {
      ...base,
      agentKey: session.key,
      slotId: mainDesk.slotId,
      x: mainDesk.x,
      z: mainDesk.z,
      heading: mainDesk.heading,
      activity: session.activity,
      attention: session.attention,
      isSubagent: false,
      label: session.name
    }
    const guests = session.subagents.slice(0, guestDesks.length).map(
      (subagent, index): AgentView => ({
        ...base,
        agentKey: `${session.key}/${subagent.id}`,
        slotId: guestDesks[index].slotId,
        x: guestDesks[index].x,
        z: guestDesks[index].z,
        heading: guestDesks[index].heading,
        activity: subagent.activity,
        attention: 'none',
        isSubagent: true,
        label: subagent.type
      })
    )
    return [main, ...guests]
  })
}
