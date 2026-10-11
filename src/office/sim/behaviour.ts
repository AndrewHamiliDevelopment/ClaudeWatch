import type {
  AgentActivity,
  AgentAttention,
  AgentView,
  SessionRef
} from '../../shared/office/types'
import type { Point } from './path'

type AgentState = 'arriving' | 'working' | 'needs_you' | 'done' | 'leaving'
export interface AgentRecord {
  view: AgentView
  state: AgentState
  path: Point[]
  dwellMs: number
  queued: AgentActivity | null
  slotHeading: number
  removed: boolean
}
type Destination = Pick<AgentView, 'floorId' | 'roomId' | 'slotId' | 'x' | 'z' | 'heading'>
const urgent = (attention: AgentAttention) =>
  ['permission', 'question', 'error', 'limited'].includes(attention)

export function createAgent(
  session: SessionRef,
  destination: Destination,
  path: Point[]
): AgentRecord {
  const start = path[0] ?? destination
  return {
    view: {
      ...destination,
      x: start.x,
      z: start.z,
      agentKey: session.key,
      activity: session.activity,
      attention: session.attention,
      provider: session.provider,
      isSubagent: false,
      label: session.name
    },
    state: 'arriving',
    path: path.map((p) => ({ ...p })),
    dwellMs: 0,
    queued: null,
    slotHeading: destination.heading,
    removed: false
  }
}

export function updateAgent(
  agent: AgentRecord,
  activity: AgentActivity,
  attention: AgentAttention
): AgentRecord {
  const next = { ...agent, view: { ...agent.view, attention } }
  if (next.state === 'leaving') return next
  if (urgent(attention)) {
    next.state = next.path.length ? 'arriving' : 'needs_you'
    next.view.heading = Math.PI
    next.view.activity = activity
    next.queued = null
    next.dwellMs = 0
  } else {
    if (next.state === 'needs_you' || (next.state === 'done' && attention !== 'done')) {
      next.state = next.path.length ? 'arriving' : 'working'
      next.view.heading = next.slotHeading
    }
    if (attention === 'done' && agent.view.attention !== 'done') {
      next.state = next.path.length ? 'arriving' : 'done'
      next.dwellMs = 0
    }
    if (activity === next.view.activity) next.queued = null
    else if (next.dwellMs >= 1500) {
      next.view.activity = activity
      next.dwellMs = 0
      next.queued = null
    } else next.queued = activity
  }
  return next
}

export function leaveAgent(agent: AgentRecord, path: Point[]): AgentRecord {
  return { ...agent, state: 'leaving', path: path.map((p) => ({ ...p })) }
}

export function tickAgent(agent: AgentRecord, dtMs: number): AgentRecord {
  const next = {
    ...agent,
    view: { ...agent.view },
    path: agent.path.map((p) => ({ ...p })),
    dwellMs: agent.dwellMs + dtMs
  }
  if (next.state === 'arriving' || next.state === 'leaving') {
    let distance = (dtMs / 1000) * 1.4
    while (next.path.length) {
      const target = next.path[0],
        dx = target.x - next.view.x,
        dz = target.z - next.view.z
      const length = Math.hypot(dx, dz)
      if (length > distance) {
        next.view.x += (dx / length) * distance
        next.view.z += (dz / length) * distance
        next.view.heading = Math.atan2(dx, dz)
        break
      }
      next.view.x = target.x
      next.view.z = target.z
      distance -= length
      next.path.shift()
    }
    if (!next.path.length) {
      if (next.state === 'leaving') next.removed = true
      else {
        next.state = urgent(next.view.attention)
          ? 'needs_you'
          : next.view.attention === 'done'
            ? 'done'
            : 'working'
        next.view.heading = next.state === 'needs_you' ? Math.PI : next.slotHeading
        if (next.state === 'done') next.dwellMs = 0
      }
    }
  }
  if (next.dwellMs >= 1500 && next.queued !== null) {
    next.view.activity = next.queued
    next.queued = null
    next.dwellMs = 0
  }
  if (next.state === 'done' && next.dwellMs >= 1500) next.state = 'working'
  return next
}
