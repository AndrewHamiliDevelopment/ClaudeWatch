import type { AgentView, SessionRef, SubagentRef } from '../../../shared/office/types'
import type { OfficeFrame, RoomGeometry } from '../scene-model'

export interface FloorSummary {
  floorId: string
  label: string
  number: number
  agentCount: number
  attentionCount: number
}

// Shared wording for counts in the Offices panel and the stacked project badge.
export function agentCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'agent' : 'agents'}`
}

export function needsYouLabel(count: number): string {
  return `${count} ${count === 1 ? 'needs' : 'need'} you`
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
function roomForAgent(frame: OfficeFrame, agent: AgentView): RoomGeometry | undefined {
  return frame.floors
    .find((floor) => floor.floorId === agent.floorId)
    ?.rooms.find((room) => room.id === agent.roomId)
}

// A theme picks an agent's character from the bay of its office; shared rooms have none.
export function bayForAgent(frame: OfficeFrame, agent: AgentView): number {
  return roomForAgent(frame, agent)?.bay ?? 0
}

// The subagent or teammate behind an agent keyed `${sessionKey}#${id}`; the lead has none.
export function memberForAgent(
  session: SessionRef | undefined,
  agentKey: string
): SubagentRef | undefined {
  if (!session || !agentKey.startsWith(`${session.key}#`)) return undefined
  const memberId = agentKey.slice(session.key.length + 1)
  return session.subagents.find((member) => member.id === memberId)
}

export function sessionForAgent(frame: OfficeFrame, agent: AgentView): SessionRef | undefined {
  const sessionKey = roomForAgent(frame, agent)?.sessionKey
  if (sessionKey) return frame.sessions.find((session) => session.key === sessionKey)
  // The shared team area belongs to no session; a subagent there is keyed `${sessionKey}#${id}`.
  return frame.sessions.find((session) => agent.agentKey.startsWith(`${session.key}#`))
}

export function mainAgentForSession(frame: OfficeFrame, sessionKey: string): AgentView | undefined {
  return frame.agents.find(
    (agent) => !agent.isSubagent && roomForAgent(frame, agent)?.sessionKey === sessionKey
  )
}
