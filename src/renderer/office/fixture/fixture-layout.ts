import { buildLayout } from '../../../office/sim/layout'
import { placements } from '../../../office/sim/placements'
import type { AgentView, SessionRef } from '../../../shared/office/types'
import { toFloorGeometry } from '../../office-live/layout-geometry'
import type { FloorGeometry } from '../scene-model'

export function fixtureLayout(sessions: readonly SessionRef[]): {
  floors: FloorGeometry[]
  agents: AgentView[]
} {
  const layout = buildLayout([...sessions], undefined, 0)
  const agents = placements([...sessions], layout).map(
    ({ session, room, slot, floorId, isSubagent }): AgentView => ({
      agentKey: session.key,
      floorId,
      roomId: room.id,
      slotId: slot.id,
      x: slot.x,
      z: slot.z,
      heading: slot.heading,
      activity: session.activity,
      attention: session.attention,
      provider: session.provider,
      isSubagent,
      label: session.name
    })
  )
  return { floors: toFloorGeometry(layout, [...sessions]), agents }
}

export function layoutFloor(options: {
  floorId: string
  label: string
  plate: number
  sessions: readonly SessionRef[]
}): FloorGeometry {
  return fixtureLayout(options.sessions).floors[0]
}

export function agentsForFloor(floor: FloorGeometry, sessions: readonly SessionRef[]): AgentView[] {
  return fixtureLayout(sessions).agents.filter((agent) =>
    floor.rooms.some((room) => room.id === agent.roomId)
  )
}
