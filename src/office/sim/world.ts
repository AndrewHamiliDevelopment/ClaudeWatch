import type { AgentView, FeedMessage, SessionRef } from '../../shared/office/types'
import { createAgent, leaveAgent, tickAgent, updateAgent, type AgentRecord } from './behaviour'
import { buildLayout, type LayoutMap } from './layout'
import { PathCache } from './navigation'
import { placements } from './placements'

export class World {
  private readonly now: () => number
  private sessions = new Map<string, SessionRef>()
  private agents = new Map<string, AgentRecord>()
  private map: LayoutMap
  private accumulatedMs = 0
  private sequence = -1
  private helloRevision = 0
  private ready = false

  constructor(options: { now: () => number; saved?: LayoutMap }) {
    this.now = options.now
    this.map = options.saved
      ? structuredClone(options.saved)
      : { version: 1, floors: [], reservations: {} }
  }

  apply(message: FeedMessage): void {
    if (message.type === 'resync') {
      this.ready = false
      return
    }
    if (message.type === 'hello') {
      this.sessions = new Map(message.snapshot.sessions.map((s) => [s.key, structuredClone(s)]))
      this.helloRevision = message.snapshot.rev
      // A patch's seq is the revision it produces, so anything at or below this one is stale.
      this.sequence = message.snapshot.rev
      this.ready = true
    } else {
      if (!this.ready || message.seq <= this.sequence) return
      this.sequence = message.seq
      for (const key of message.removed) this.sessions.delete(key)
      for (const session of message.upserts)
        this.sessions.set(session.key, structuredClone(session))
    }
    const oldMap = this.map
    this.map = buildLayout([...this.sessions.values()], this.map, this.now())
    const paths = new PathCache(this.map.floors[0])
    const oldPaths = oldMap.floors[0]?.zones ? new PathCache(oldMap.floors[0]) : paths
    const held = new Map(
      [...this.agents]
        .filter(([, agent]) => agent.state !== 'leaving')
        .map(([key, agent]) => [key, agent.view])
    )
    const desired = placements([...this.sessions.values()], this.map, held)
    const active = new Set(desired.map((p) => p.session.key))
    for (const [key, agent] of this.agents) {
      if (active.has(key) || agent.state === 'leaving') continue
      const floor = oldMap.floors.find((f) => f.id === agent.view.floorId)!
      const room = floor.rooms.find((r) => r.id === agent.view.roomId)!
      const door = room.slots.find((s) => s.id === 'door')!
      this.agents.set(key, leaveAgent(agent, oldPaths.via(agent.view, door, floor.elevator)))
    }
    for (const placement of desired) {
      const { session, room, slot, floorId, isSubagent } = placement
      const existing = this.agents.get(session.key)
      const oldSlot = oldMap.floors[0]?.rooms
        .find((r) => r.id === room.id)
        ?.slots.find((s) => s.id === slot.id)
      if (
        existing &&
        existing.state !== 'leaving' &&
        existing.view.roomId === room.id &&
        existing.view.slotId === slot.id &&
        oldSlot?.x === slot.x &&
        oldSlot?.z === slot.z
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
      // A seat that moved is walked to from where the agent stands; only newcomers use the gate.
      const isSeated = existing && existing.state !== 'leaving'
      const route = isSeated ? paths.get(existing.view, slot) : []
      const agent = createAgent(
        session,
        destination,
        route.length ? route : paths.via(elevator, door, slot)
      )
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

  revision(): number {
    return this.helloRevision
  }

  layout(): LayoutMap {
    return structuredClone(this.map)
  }
}
