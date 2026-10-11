import type { SessionRef } from '../../shared/office/types'
import type { FloorLayout, LayoutMap } from './layout'

export function allocateRoom(
  session: SessionRef,
  sessions: SessionRef[],
  floor: FloorLayout,
  layout: LayoutMap
): LayoutMap['reservations'][string] {
  const wing =
    session.worktree === null
      ? [session]
      : sessions.filter((s) => s.projectKey === floor.id && s.worktree === session.worktree)
  const existing = wing.flatMap((s) =>
    layout.reservations[s.key] ? [layout.reservations[s.key]] : []
  )
  let index = existing.length ? Math.max(...existing.map((r) => r.plate * 16 + r.bay)) + 1 : 0
  const pending = wing.filter((s) => !layout.reservations[s.key])
  const capacity = pending.some((s) => s.subagents.length > 4) ? 15 : 16
  const occupied = (index: number) => {
    const plate = Math.floor(index / 16),
      bay = index % 16
    return (
      Object.values(layout.reservations).some(
        (r) => r.floorId === floor.id && r.plate === plate && r.bay === bay
      ) || floor.rooms.some((r) => r.kind === 'team' && r.plate === plate && r.bay === bay)
    )
  }
  while (true) {
    const plate = Math.floor(index / 16),
      bay = index % 16
    const size = Math.min(pending.length, existing.length ? capacity - bay : capacity)
    const fits =
      size > 0 &&
      bay + size <= 16 &&
      Array.from({ length: size }, (_, offset) => index + offset).every(
        (candidate) =>
          !occupied(candidate) &&
          !(candidate % 16 === 15 && pending.some((s) => s.subagents.length > 4))
      )
    if (fits) return { floorId: floor.id, plate, bay, releasedAtMs: null }
    index++
  }
}
