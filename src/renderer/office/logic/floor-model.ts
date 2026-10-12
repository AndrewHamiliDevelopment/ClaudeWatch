import { agentKey, parseAgentKey } from '../../../shared/office/agent-key'
import { needsHuman } from '../../../shared/office/attention'
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

export function summariseFloors(frame: OfficeFrame): FloorSummary[] {
  return frame.floors.map((floor, index) => {
    const agents = frame.agents.filter((agent) => agent.floorId === floor.floorId)
    return {
      floorId: floor.floorId,
      label: floor.label,
      number: index + 1,
      agentCount: agents.length,
      attentionCount: agents.filter((agent) => needsHuman(agent.attention)).length
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

// The subagent or teammate an agent key names within its session; the lead has none.
export function memberForAgent(
  session: SessionRef | undefined,
  key: string
): SubagentRef | undefined {
  return session ? parseAgentKey(key, [session])?.member : undefined
}

export function sessionForAgent(frame: OfficeFrame, agent: AgentView): SessionRef | undefined {
  const sessionKey = roomForAgent(frame, agent)?.sessionKey
  if (sessionKey) return frame.sessions.find((session) => session.key === sessionKey)
  // The shared team area belongs to no session. Matched by prefix, not parsed: a subagent
  // walking out is no longer listed by its lead, and still belongs to it.
  return frame.sessions.find((session) => agent.agentKey.startsWith(agentKey(session.key, '')))
}

export function mainAgentForSession(frame: OfficeFrame, sessionKey: string): AgentView | undefined {
  return frame.agents.find(
    (agent) => !agent.isSubagent && roomForAgent(frame, agent)?.sessionKey === sessionKey
  )
}
