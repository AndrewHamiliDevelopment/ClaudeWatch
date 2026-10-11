import type { AgentView, FeedMessage, SessionRef } from '../../shared/office/types'
import { createAgent, leaveAgent, tickAgent, updateAgent, type AgentRecord } from './behaviour'
import { buildLayout, type LayoutMap } from './layout'
import { PathCache } from './navigation'
import { placements } from './placements'

export class World {
  private readonly now: () => number
  private readonly paths = new PathCache()
  private sessions = new Map<string, SessionRef>()
  private agents = new Map<string, AgentRecord>()
  private map: LayoutMap
  private accumulatedMs = 0
  private sequence = -1

  constructor(options: { now: () => number; saved?: LayoutMap }) {
    this.now = options.now
    this.map = options.saved
      ? structuredClone(options.saved)
      : { version: 1, floors: [], reservations: {} }
  }

  apply(message: FeedMessage): void {
    if (message.type === 'resync') return
    if (message.type === 'hello') {
      this.sessions = new Map(message.snapshot.sessions.map((s) => [s.key, structuredClone(s)]))
      this.sequence = message.snapshot.rev
    } else {
      if (message.seq <= this.sequence) return
      this.sequence = message.seq
      for (const key of message.removed) this.sessions.delete(key)
      for (const session of message.upserts)
        this.sessions.set(session.key, structuredClone(session))
    }
    const oldMap = this.map
    this.map = buildLayout([...this.sessions.values()], this.map, this.now())
    const desired = placements([...this.sessions.values()], this.map)
    const active = new Set(desired.map((p) => p.session.key))
    for (const [key, agent] of this.agents) {
      if (active.has(key) || agent.state === 'leaving') continue
      const floor = oldMap.floors.find((f) => f.id === agent.view.floorId)!
      const room = floor.rooms.find((r) => r.id === agent.view.roomId)!
      const door = room.slots.find((s) => s.id === 'door')!
      this.agents.set(key, leaveAgent(agent, this.paths.via(agent.view, door, floor.elevator)))
    }
    for (const placement of desired) {
      const { session, room, slot, floorId, isSubagent } = placement
      const existing = this.agents.get(session.key)
      if (
        existing &&
        existing.state !== 'leaving' &&
        existing.view.roomId === room.id &&
        existing.view.slotId === slot.id
      ) {
        const updated = updateAgent(existing, session.activity, session.attention)
        updated.view.label = session.name
        this.agents.set(session.key, updated)
        continue
      }
      const elevator = this.map.floors.find((f) => f.id === floorId)!.elevator
      const door = room.slots.find((s) => s.id === 'door')!
      const destination = {
        floorId,
        roomId: room.id,
        slotId: slot.id,
        x: slot.x,
        z: slot.z,
        heading: slot.heading
      }
      const agent = createAgent(session, destination, this.paths.via(elevator, door, slot))
      agent.view.isSubagent = isSubagent
      this.agents.set(session.key, agent)
    }
  }

  step(dtMs: number): AgentView[] {
    this.accumulatedMs += Number.isFinite(dtMs) ? Math.max(0, Math.min(1000, dtMs)) : 0
    while (this.accumulatedMs >= 100) {
      for (const [key, agent] of this.agents) {
        const next = tickAgent(agent, 100)
        if (next.removed) this.agents.delete(key)
        else this.agents.set(key, next)
      }
      this.accumulatedMs -= 100
    }
    return [...this.agents.values()]
      .sort((a, b) => a.view.agentKey.localeCompare(b.view.agentKey))
      .map((a) => ({ ...a.view }))
  }

  layout(): LayoutMap {
    return structuredClone(this.map)
  }
}
