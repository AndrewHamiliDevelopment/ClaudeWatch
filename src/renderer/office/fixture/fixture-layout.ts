import { buildLayout, type LayoutMap } from '../../../office/sim/layout'
import { placements } from '../../../office/sim/placements'
import type { AgentView, SessionRef } from '../../../shared/office/types'
import { toFloorGeometry } from '../../office-live/layout-geometry'
import type { FloorGeometry } from '../scene-model'

// Passing the previous layout back as `saved` keeps offices where they are when session counts
// change, the way the live feed's World does; without it every tick re-packs the floor.
export function fixtureLayout(
  sessions: readonly SessionRef[],
  saved?: LayoutMap,
  nowMs = 0
): {
  floors: FloorGeometry[]
  agents: AgentView[]
  layout: LayoutMap
} {
  const layout = buildLayout([...sessions], saved, nowMs)
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
  return { floors: toFloorGeometry(layout, [...sessions]), agents, layout }
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
