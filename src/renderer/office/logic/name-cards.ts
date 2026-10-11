import type { AgentActivity, AgentView } from '../../../shared/office/types'
import type { OfficeFrame } from '../scene-model'
import { agentCountLabel, needsHuman, needsYouLabel, sessionForAgent } from './floor-model'
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
  // Culling groups cards by project and breaks priority ties toward the latest update.
  projectKey: string | null
  updatedAtMs: number
}

export interface ProjectStack {
  projectKey: string
  zoneId: string | null
  x: number
  z: number
  text: string
}

// One DOM node per card; screen-space culling (card-culling.ts) decides which are shown.
export const MAX_NAME_CARDS = 40

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
  if (card.status === 'error' || card.status === 'limited') return 2
  return card.kind === 'card' ? 3 : 4
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
      const meta = {
        projectKey: session?.projectKey ?? null,
        updatedAtMs: session?.updatedAtMs ?? 0
      }
      if (agent.isSubagent) {
        return {
          agentKey: agent.agentKey,
          kind: 'pill',
          sessionKey: null,
          x: agent.x,
          z: agent.z,
          title: agent.label,
          detail: '',
          status: statusFor(agent),
          ...meta
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
        status: statusFor(agent),
        ...meta
      }
    })
  return cards
    .sort((a, b) => priority(a, selectedAgentKey) - priority(b, selectedAgentKey))
    .slice(0, MAX_NAME_CARDS)
}

// One summary per project for the stacked badge shown when its cards crowd together.
export function buildProjectStacks(frame: OfficeFrame, floorId: string): ProjectStack[] {
  const floor = frame.floors.find((candidate) => candidate.floorId === floorId)
  // Group once, so each project does not rescan every agent.
  const membersByProject = new Map<string, AgentView[]>()
  for (const agent of frame.agents) {
    const projectKey =
      agent.floorId === floorId ? sessionForAgent(frame, agent)?.projectKey : undefined
    if (!projectKey) continue
    const members = membersByProject.get(projectKey)
    if (members) members.push(agent)
    else membersByProject.set(projectKey, [agent])
  }
  return (floor?.zones ?? [])
    .flatMap((company) => company.children.filter((child) => child.kind === 'project'))
    .flatMap((zone) => {
      const members = zone.projectKey ? membersByProject.get(zone.projectKey) : undefined
      if (!zone.projectKey || !members) return []
      const waiting = members.filter(needsHuman).length
      const parts = [zone.label, agentCountLabel(members.length)]
      if (waiting > 0) parts.push(needsYouLabel(waiting))
      return [
        {
          projectKey: zone.projectKey,
          zoneId: zone.id,
          x: zone.x,
          z: zone.z,
          text: parts.join(' · ')
        }
      ]
    })
}
