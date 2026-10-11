import type { SessionRef } from '../../shared/office/types'
import type { LayoutMap, RoomLayout, Slot } from './layout'

export interface Placement {
  session: SessionRef
  room: RoomLayout
  slot: Slot
  floorId: string
  isSubagent: boolean
}

// Where an agent already sits, so a finishing sibling never re-seats the ones still working.
export type HeldSeats = ReadonlyMap<string, { roomId: string; slotId: string }>

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
  for (const session of [...sessions].sort((a, b) => a.key.localeCompare(b.key))) {
    const main = floor.rooms.find((r) => r.sessionKey === session.key)
    if (!main) continue
    result.push({
      session,
      room: main,
      slot: main.slots.find((s) => s.id === 'desk_main')!,
      floorId: floor.id,
      isSubagent: false
    })
    if (!session.subagents.length) continue
    const team = floor.rooms.find(
      (r) =>
        r.kind === 'team' &&
        r.companyKey === session.companyKey &&
        r.projectKey === session.projectKey
    )!
    const taken = takenSeats.get(team.id) ?? new Set<string>()
    takenSeats.set(team.id, taken)
    const guests = session.subagents
      .map((subagent) => ({
        ...session,
        key: `${session.key}#${subagent.id}`,
        // A teammate is known by its own name; a subagent only by its type.
        name: subagent.name ?? subagent.type,
        activity: subagent.activity,
        attention: 'none' as const
      }))
      .sort((a, b) => a.key.localeCompare(b.key))
    const seatOf = (guest: SessionRef, room: RoomLayout): string | undefined =>
      held.get(guest.key)?.roomId === room.id ? held.get(guest.key)!.slotId : undefined
    const freeDesks = new Set(GUEST_DESKS)
    const waiting: SessionRef[] = []
    for (const guest of guests) {
      const desk = seatOf(guest, main)
      if (desk && freeDesks.delete(desk)) seated.push({ session: guest, room: main, slotId: desk })
      else waiting.push(guest)
    }
    // New arrivals take a free guest desk first, so team-area sitters move only when they must.
    waiting.sort((a, b) => Number(held.has(a.key)) - Number(held.has(b.key)))
    for (const guest of waiting) {
      const [desk] = freeDesks
      const seat = seatOf(guest, team)
      if (desk) {
        freeDesks.delete(desk)
        seated.push({ session: guest, room: main, slotId: desk })
      } else if (seat && !taken.has(seat) && team.slots.some((s) => s.id === seat)) {
        taken.add(seat)
        seated.push({ session: guest, room: team, slotId: seat })
      } else unseated.push({ session: guest, team })
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
      isSubagent: true
    })
  }
  return result
}
