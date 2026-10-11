import type { SessionRef } from '../../shared/office/types'
import { room, type FloorLayout } from './rooms'
import { allocateRoom } from './allocation'
export type { FloorLayout, RoomLayout, Slot } from './rooms'

export interface LayoutMap {
  version: 1
  floors: FloorLayout[]
  reservations: Record<
    string,
    { floorId: string; plate: number; bay: number; releasedAtMs: number | null }
  >
}

export function buildLayout(
  sessions: SessionRef[],
  saved: LayoutMap | undefined,
  nowMs: number
): LayoutMap {
  const layout: LayoutMap = saved
    ? structuredClone(saved)
    : { version: 1, floors: [], reservations: {} }
  const active = new Set(sessions.map((s) => s.key))
  for (const [key, reservation] of Object.entries(layout.reservations)) {
    if (!active.has(key)) reservation.releasedAtMs ??= nowMs
    if (reservation.releasedAtMs !== null && nowMs - reservation.releasedAtMs >= 86400000)
      delete layout.reservations[key]
  }
  for (const floor of layout.floors) floor.rooms = floor.rooms.filter((r) => r.kind === 'team')
  const ordered = [...sessions].sort(
    (a, b) =>
      a.projectKey.localeCompare(b.projectKey) ||
      (a.worktree ?? '~').localeCompare(b.worktree ?? '~') ||
      a.key.localeCompare(b.key)
  )
  for (const session of ordered) {
    let floor = layout.floors.find((f) => f.id === session.projectKey)
    if (!floor) {
      floor = {
        id: session.projectKey,
        label: session.projectLabel,
        rooms: [],
        elevator: { id: 'elevator', x: 0, z: 0, heading: 0 }
      }
      layout.floors.push(floor)
    }
    let reservation: LayoutMap['reservations'][string] | undefined =
      layout.reservations[session.key]
    if (reservation && reservation.floorId !== floor.id) {
      delete layout.reservations[session.key]
      reservation = undefined
    }
    if (!reservation) {
      reservation = allocateRoom(session, ordered, floor, layout)
      layout.reservations[session.key] = reservation
    }
    reservation.releasedAtMs = null
    floor.rooms.push(
      room(floor.id, reservation.plate, reservation.bay, session.key, session.worktree)
    )
    const overflow = ordered
      .filter((s) => s.projectKey === floor.id)
      .reduce((n, s) => n + Math.max(0, s.subagents.length - 4), 0)
    while (floor.rooms.filter((r) => r.kind === 'team').length * 12 < overflow) {
      let plate = reservation.plate
      while (
        Object.values(layout.reservations).some(
          (r) => r.floorId === floor.id && r.plate === plate && r.bay === 15
        ) ||
        floor.rooms.some((r) => r.kind === 'team' && r.plate === plate)
      )
        plate++
      floor.rooms.push(room(floor.id, plate, 15, null, null))
    }
  }
  for (const floor of layout.floors) floor.rooms.sort((a, b) => a.plate - b.plate || a.bay - b.bay)
  return layout
}
