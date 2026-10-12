import { agentKey } from '../../shared/office/agent-key'
import type { SessionRef } from '../../shared/office/types'
import type { LayoutMap, RoomLayout, Slot } from './layout'

export interface Placement {
  session: SessionRef
  room: RoomLayout
  slot: Slot
  floorId: string
  isSubagent: boolean
  // Its work is over for now, so it may go and sit in the lounge.
  isFinished: boolean
}

// Where an agent already sits, so a finishing sibling never re-seats the ones still working.
type HeldSeats = ReadonlyMap<string, { roomId: string; slotId: string }>

const GUEST_DESKS = ['desk_guest_0', 'desk_guest_1']

export function placements(
  sessions: SessionRef[],
  layout: LayoutMap,
  held: HeldSeats = new Map()
): Placement[] {
  const floor = layout.floors[0]
  if (!floor) return []
  const result: Placement[] = []
  const seated: { session: SessionRef; room: RoomLayout; slotId: string }[] = []
  const unseated: { session: SessionRef; team: RoomLayout }[] = []
  const takenSeats = new Map<string, Set<string>>()
  const teamKey = (companyKey: string, projectKey: string | null) => `${companyKey}\n${projectKey}`
  const offices = new Map(floor.rooms.map((room) => [room.sessionKey, room]))
  const teams = new Map(
    floor.rooms
      .filter((room) => room.kind === 'team')
      .map((room) => [teamKey(room.companyKey, room.projectKey), room])
  )
  for (const session of [...sessions].sort((a, b) => a.key.localeCompare(b.key))) {
    const main = offices.get(session.key)
    if (!main) continue
    result.push({
      session,
      room: main,
      slot: main.slots.find((s) => s.id === 'desk_main')!,
      floorId: floor.id,
      isSubagent: false,
      isFinished: session.attention === 'done'
    })
    if (!session.subagents.length) continue
    // Absent while every guest in the project fits at a desk's own guest seats.
    const team = teams.get(teamKey(session.companyKey, session.projectKey))
    const taken = team && (takenSeats.get(team.id) ?? new Set<string>())
    if (team && taken) takenSeats.set(team.id, taken)
    // Teammates stay for the whole job and subagents come and go, so teammates sit at the desks
    // beside their lead and subagents in the team area: a subagent leaving moves nobody who stays.
    const guests = [...session.subagents]
      .sort(
        (a, b) =>
          Number(b.kind === 'teammate') - Number(a.kind === 'teammate') || a.id.localeCompare(b.id)
      )
      .map((subagent) => ({
        ...session,
        key: agentKey(session.key, subagent.id),
        // A teammate is known by its own name; a subagent only by its type.
        name: subagent.name ?? subagent.type,
        activity: subagent.activity,
        attention: 'none' as const
      }))
    const seatOf = (guest: SessionRef, room: RoomLayout): string | undefined =>
      held.get(guest.key)?.roomId === room.id ? held.get(guest.key)!.slotId : undefined
    const freeDesks = new Set(GUEST_DESKS)
    const waiting: SessionRef[] = []
    for (const guest of guests) {
      const desk = seatOf(guest, main)
      if (desk && freeDesks.delete(desk)) seated.push({ session: guest, room: main, slotId: desk })
      else waiting.push(guest)
    }
    // A guest whose team seat still stands keeps it: a desk freeing up is no reason to get up.
    const homeless: SessionRef[] = []
    for (const guest of waiting) {
      const seat = team && taken ? seatOf(guest, team) : undefined
      if (team && taken && seat && !taken.has(seat) && team.slots.some((s) => s.id === seat)) {
        taken.add(seat)
        seated.push({ session: guest, room: team, slotId: seat })
      } else homeless.push(guest)
    }
    // New arrivals and guests whose seat went take the free guest desks, then the team seats.
    homeless.sort((a, b) => Number(held.has(b.key)) - Number(held.has(a.key)))
    for (const guest of homeless) {
      const [desk] = freeDesks
      if (desk) {
        freeDesks.delete(desk)
        seated.push({ session: guest, room: main, slotId: desk })
        continue
      }
      // The map gives a team seat to every guest past the desks, so a guest here has a team.
      if (team) unseated.push({ session: guest, team })
    }
  }
  for (const { session, team } of unseated) {
    const taken = takenSeats.get(team.id)!
    const seat = team.slots.find((s) => s.id.startsWith('team_seat_') && !taken.has(s.id))!
    taken.add(seat.id)
    seated.push({ session, room: team, slotId: seat.id })
  }
  for (const { session, room, slotId } of seated) {
    result.push({
      session,
      room,
      slot: room.slots.find((s) => s.id === slotId)!,
      floorId: floor.id,
      isSubagent: true,
      // A guest has no attention of its own: only a teammate gone quiet for a minute reports
      // idle, and a subagent is listed as thinking until it drops off the list.
      isFinished: session.activity === 'idle'
    })
  }
  return result
}
