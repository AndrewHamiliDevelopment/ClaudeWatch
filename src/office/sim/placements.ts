import type { SessionRef } from '../../shared/office/types'
import type { LayoutMap, RoomLayout, Slot } from './layout'

export interface Placement {
  session: SessionRef
  room: RoomLayout
  slot: Slot
  floorId: string
  isSubagent: boolean
}

export function placements(sessions: SessionRef[], layout: LayoutMap): Placement[] {
  const result: Placement[] = []
  for (const floor of layout.floors) {
    const teams = floor.rooms.filter((r) => r.kind === 'team')
    let teamIndex = 0
    for (const session of [...sessions]
      .filter((s) => s.projectKey === floor.id)
      .sort((a, b) => a.key.localeCompare(b.key))) {
      const main = floor.rooms.find((r) => r.sessionKey === session.key)!
      result.push({
        session,
        room: main,
        slot: main.slots.find((s) => s.id === 'desk_main')!,
        floorId: floor.id,
        isSubagent: false
      })
      for (const [index, subagent] of [...session.subagents]
        .sort((a, b) => a.id.localeCompare(b.id))
        .entries()) {
        const room = index < 4 ? main : teams[Math.floor(teamIndex / 12)]
        const slotId = index < 4 ? `desk_guest_${index}` : `team_seat_${teamIndex++ % 12}`
        result.push({
          session: {
            ...session,
            key: `${session.key}#${subagent.id}`,
            name: subagent.type,
            activity: subagent.activity,
            attention: 'none'
          },
          room,
          slot: room.slots.find((s) => s.id === slotId)!,
          floorId: floor.id,
          isSubagent: true
        })
      }
    }
  }
  return result
}
