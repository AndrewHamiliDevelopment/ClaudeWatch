import type { AgentView, FeedMessage, SessionRef } from '../../shared/office/types'
import { clamp } from '../../shared/range'
import {
  createAgent,
  goToLounge,
  leaveAgent,
  returnToDesk,
  setFinished,
  tickAgent,
  updateAgent,
  type AgentRecord
} from './behaviour'
import { buildLayout, type LayoutMap, type LoungeLayout } from './layout'
import { loungeSeats, loungesByRoom } from './lounge'
import { PathCache } from './navigation'
import type { Point } from './path'
import { placements } from './placements'

// A walker can stand outside a floor that shrank, where the grid has no way: it then walks
// straight there, so it is never left behind and never jumps.
function wayTo(paths: PathCache, from: Point, to: Point): Point[] {
  const path = paths.get(from, to)
  return path.length ? path : [from, to].map(({ x, z }) => ({ x, z }))
}

const NO_LOUNGES: ReadonlyMap<string, LoungeLayout> = new Map()

export class World {
  private sessions = new Map<string, SessionRef>()
  private agents = new Map<string, AgentRecord>()
  private map: LayoutMap
  private paths: PathCache | null = null
  // The floor `paths` and `lounges` were made for.
  private floorJson = ''
  private lounges = new Map<string, LoungeLayout>()
  private accumulatedMs = 0
  private sequence = -1
  private helloRevision = 0
  private ready = false
  private hasLoungeTrips: boolean

  // `loungeTrips: false` keeps finished agents at their desks.
  constructor(options: { saved?: LayoutMap; loungeTrips?: boolean } = {}) {
    this.hasLoungeTrips = options.loungeTrips ?? true
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
    this.map = buildLayout([...this.sessions.values()], this.map)
    // Routes and lounges follow from the floor alone: while it stands as it was, the routes
    // already found are kept rather than searched for again.
    const floorJson = JSON.stringify(this.map.floors[0])
    const isSameFloor = floorJson === this.floorJson
    if (!isSameFloor || !this.paths) {
      this.paths = new PathCache(this.map.floors[0])
      this.lounges = loungesByRoom(this.map.floors[0])
      this.floorJson = floorJson
    }
    const paths = this.paths
    const oldPaths =
      isSameFloor || !oldMap.floors[0]?.zones ? paths : new PathCache(oldMap.floors[0])
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
      // From the lounge it walks straight out: its office door is not on the way.
      const exit =
        agent.view.place === 'lounge'
          ? oldPaths.get(agent.view, floor.elevator)
          : oldPaths.via(agent.view, door, floor.elevator)
      this.agents.set(key, leaveAgent(agent, exit))
    }
    const oldRooms = new Map(oldMap.floors[0]?.rooms.map((r) => [r.id, r]))
    for (const placement of desired) {
      const { session, room, slot, floorId, isSubagent, isFinished } = placement
      const existing = this.agents.get(session.key)
      if (existing?.view.place === 'lounge') {
        const updated = setFinished(
          updateAgent(existing, session.activity, session.attention),
          isFinished
        )
        // The desk it will go back to is the one the map gives it now.
        Object.assign(updated.view, {
          floorId,
          roomId: room.id,
          slotId: slot.id,
          label: session.name
        })
        this.agents.set(
          session.key,
          isFinished
            ? updated
            : returnToDesk(updated, slot.heading, wayTo(paths, updated.view, slot))
        )
        continue
      }
      const oldSlot = oldRooms.get(room.id)?.slots.find((s) => s.id === slot.id)
      if (
        existing &&
        oldSlot &&
        existing.state !== 'leaving' &&
        existing.view.roomId === room.id &&
        existing.view.slotId === slot.id
      ) {
        const hasSeatMoved = oldSlot.x !== slot.x || oldSlot.z !== slot.z
        const isSeated =
          existing.path.length === 0 &&
          existing.view.x === oldSlot.x &&
          existing.view.z === oldSlot.z
        if (!hasSeatMoved || isSeated) {
          const updated = updateAgent(existing, session.activity, session.attention)
          updated.view.label = session.name
          // Its office slid along with a neighbour that grew: it goes with its desk, seated.
          if (hasSeatMoved) Object.assign(updated.view, { x: slot.x, z: slot.z })
          this.agents.set(session.key, setFinished(updated, isFinished))
          continue
        }
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
      // A robot already on the floor (given another seat, on its way when its seat moved, or
      // walking out when its session came back) walks from where it stands. Sessions already running when the office opens are
      // at their desks; only later arrivals walk in from the gate.
      const route = existing ? wayTo(paths, existing.view, slot) : []
      const entrance = message.type === 'hello' ? [] : paths.via(elevator, door, slot)
      const agent = createAgent(session, destination, route.length ? route : entrance)
      agent.view.isSubagent = isSubagent
      // A desk that moved does not restart its wait for the lounge.
      agent.finishedForMs = existing?.finishedForMs ?? null
      this.agents.set(session.key, setFinished(agent, isFinished))
    }
    this.seatLounges()
  }

  // Sends waiting agents to a free lounge seat, sitters to a seat the map moved, and sitters
  // whose seat is gone back to their desks.
  private seatLounges(): void {
    const paths = this.paths
    if (!paths) return
    // With trips off no seat is on offer, so nobody sets out and every sitter walks back.
    const lounges = this.hasLoungeTrips ? this.lounges : NO_LOUNGES
    for (const [key, seat] of loungeSeats([...this.agents.values()], lounges)) {
      const agent = this.agents.get(key)
      if (!agent) continue
      const isAway = agent.view.place === 'lounge'
      if (seat) {
        const target = agent.path.at(-1) ?? agent.view
        if (isAway && target.x === seat.x && target.z === seat.z) continue
        this.agents.set(key, goToLounge(agent, seat, wayTo(paths, agent.view, seat)))
        continue
      }
      const desk = this.map.floors[0].rooms
        .find((r) => r.id === agent.view.roomId)
        ?.slots.find((s) => s.id === agent.view.slotId)
      if (isAway && desk)
        this.agents.set(key, returnToDesk(agent, desk.heading, wayTo(paths, agent.view, desk)))
    }
  }

  // Takes effect at the next step: agents in the lounge walk back, or waiting ones set out.
  setLoungeTrips(hasLoungeTrips: boolean): void {
    this.hasLoungeTrips = hasLoungeTrips
  }

  step(dtMs: number): AgentView[] {
    this.accumulatedMs += Number.isFinite(dtMs) ? clamp(dtMs, [0, 1000]) : 0
    while (this.accumulatedMs >= 100) {
      for (const [key, agent] of this.agents) {
        const next = tickAgent(agent, 100)
        if (next.removed) this.agents.delete(key)
        else this.agents.set(key, next)
      }
      this.seatLounges()
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
