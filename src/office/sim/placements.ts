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
  const floor = layout.floors[0]
  if (!floor) return []
  const result: Placement[] = []
  const teamIndices = new Map<string, number>()
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
    for (const [index, subagent] of [...session.subagents]
      .sort((a, b) => a.id.localeCompare(b.id))
      .entries()) {
      const team = floor.rooms.find(
        (r) =>
          r.kind === 'team' &&
          r.companyKey === session.companyKey &&
          r.projectKey === session.projectKey
      )!
      const teamIndex = teamIndices.get(team.id) ?? 0
      const room = index < 2 ? main : team
      const slotId = index < 2 ? `desk_guest_${index}` : `team_seat_${teamIndex}`
      if (index >= 2) teamIndices.set(team.id, teamIndex + 1)
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
  return result
}
