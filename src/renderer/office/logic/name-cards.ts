import type { AgentActivity, AgentView } from '../../../shared/office/types'
import type { OfficeFrame } from '../scene-model'
import { sessionForAgent } from './floor-model'
import { DESK_REACH } from './room-layout'
import { GEM_SPECS } from './status-gem'

export type CardStatus =
  | 'working'
  | 'waiting'
  | 'permission'
  | 'done'
  | 'error'
  | 'limited'
  | 'idle'

export interface NameCard {
  agentKey: string
  // Set for main agents, so the card can offer Review for that session.
  sessionKey: string | null
  kind: 'card' | 'pill'
  x: number
  z: number
  title: string
  detail: string
  status: CardStatus
}

// drei Html is a DOM node per card; past a dozen the layout cost outweighs the read.
export const MAX_NAME_CARDS = 12

const ACTIVITY_LABEL: Record<AgentActivity, string> = {
  idle: 'Idle',
  thinking: 'Thinking',
  reading: 'Reading',
  editing: 'Editing',
  running: 'Running',
  searching: 'Searching',
  delegating: 'Delegating'
}

function statusFor(agent: AgentView): CardStatus {
  switch (agent.attention) {
    case 'permission':
      return 'permission'
    case 'question':
      return 'waiting'
    case 'none':
      return agent.activity === 'idle' ? 'idle' : 'working'
    default:
      return agent.attention
  }
}

function detailFor(agent: AgentView, toolName: string | undefined): string {
  if (agent.attention !== 'none') return GEM_SPECS[agent.attention].label
  const activity = ACTIVITY_LABEL[agent.activity]
  return toolName ? `${activity} · ${toolName}` : activity
}

function priority(card: NameCard, selectedAgentKey: string | null): number {
  if (card.agentKey === selectedAgentKey) return 0
  if (card.status === 'permission' || card.status === 'waiting') return 1
  return card.kind === 'card' ? 2 : 3
}

export function buildNameCards(
  frame: OfficeFrame,
  floorId: string,
  selectedAgentKey: string | null
): NameCard[] {
  const cards = frame.agents
    .filter((agent) => agent.floorId === floorId)
    .map((agent): NameCard => {
      const session = sessionForAgent(frame, agent)
      if (agent.isSubagent) {
        return {
          agentKey: agent.agentKey,
          kind: 'pill',
          sessionKey: null,
          x: agent.x,
          z: agent.z,
          title: agent.label,
          detail: '',
          status: statusFor(agent)
        }
      }
      return {
        agentKey: agent.agentKey,
        kind: 'card',
        sessionKey: session?.key ?? null,
        x: agent.x + Math.sin(agent.heading) * DESK_REACH,
        z: agent.z + Math.cos(agent.heading) * DESK_REACH,
        title: session?.name ?? agent.label,
        detail: detailFor(agent, session?.currentTool?.name),
        status: statusFor(agent)
      }
    })
  return cards
    .sort((a, b) => priority(a, selectedAgentKey) - priority(b, selectedAgentKey))
    .slice(0, MAX_NAME_CARDS)
}
