import type { AgentView, SessionRef } from '../../../shared/office/types'
import type { OfficeFrame, RoomGeometry } from '../scene-model'

export interface FloorSummary {
  floorId: string
  label: string
  number: number
  agentCount: number
  attentionCount: number
}

export interface ListRoom {
  roomId: string
  label: string
  agents: AgentView[]
}

export interface ListFloor {
  floorId: string
  label: string
  rooms: ListRoom[]
}

export function needsHuman(agent: Pick<AgentView, 'attention'>): boolean {
  return agent.attention === 'permission' || agent.attention === 'question'
}

export function summariseFloors(frame: OfficeFrame): FloorSummary[] {
  return frame.floors.map((floor, index) => {
    const agents = frame.agents.filter((agent) => agent.floorId === floor.floorId)
    return {
      floorId: floor.floorId,
      label: floor.label,
      number: index + 1,
      agentCount: agents.length,
      attentionCount: agents.filter(needsHuman).length
    }
  })
}

// Rooms carry the session key, so lookups go through the room instead of guessing agentKey formats.
export function roomForAgent(frame: OfficeFrame, agent: AgentView): RoomGeometry | undefined {
  return frame.floors
    .find((floor) => floor.floorId === agent.floorId)
    ?.rooms.find((room) => room.id === agent.roomId)
}

export function sessionForAgent(frame: OfficeFrame, agent: AgentView): SessionRef | undefined {
  const sessionKey = roomForAgent(frame, agent)?.sessionKey
  return frame.sessions.find((session) => session.key === sessionKey)
}

export function mainAgentForSession(frame: OfficeFrame, sessionKey: string): AgentView | undefined {
  return frame.agents.find(
    (agent) => !agent.isSubagent && roomForAgent(frame, agent)?.sessionKey === sessionKey
  )
}

function mainAgentFirst(a: AgentView, b: AgentView): number {
  return Number(a.isSubagent) - Number(b.isSubagent) || a.label.localeCompare(b.label)
}

export function buildListTree(frame: OfficeFrame): ListFloor[] {
  return frame.floors.map((floor) => ({
    floorId: floor.floorId,
    label: floor.label,
    rooms: floor.rooms.map((room) => ({
      roomId: room.id,
      label: room.label,
      agents: frame.agents
        .filter((agent) => agent.floorId === floor.floorId && agent.roomId === room.id)
        .sort(mainAgentFirst)
    }))
  }))
}
