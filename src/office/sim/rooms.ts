export interface Slot {
  id: string
  x: number
  z: number
  heading: number
}
export interface RoomLayout {
  id: string
  sessionKey: string | null
  worktree: string | null
  kind: 'session' | 'team'
  plate: number
  bay: number
  slots: Slot[]
}
export interface FloorLayout {
  id: string
  label: string
  rooms: RoomLayout[]
  elevator: Slot
}

export function room(
  floorId: string,
  plate: number,
  bay: number,
  sessionKey: string | null,
  worktree: string | null
): RoomLayout {
  const x = (bay % 8) * 6 + 3
  const side = bay < 8 ? 1 : -1
  const slot = (id: string, dx: number, depth: number): Slot => ({
    id,
    x: x + dx,
    z: side * (0.75 + depth),
    heading: 0
  })
  const slots =
    sessionKey === null
      ? Array.from({ length: 12 }, (_, i) =>
          slot(`team_seat_${i}`, ((i % 3) - 1) * 1.5, 1 + Math.floor(i / 3))
        )
      : [
          slot('desk_main', 0, 3),
          ...Array.from({ length: 4 }, (_, i) =>
            slot(`desk_guest_${i}`, i % 2 ? 1.5 : -1.5, i < 2 ? 2 : 4.5)
          )
        ]
  return {
    id: `${floorId}:${plate}:${bay}`,
    sessionKey,
    worktree,
    kind: sessionKey === null ? 'team' : 'session',
    plate,
    bay,
    slots: [slot('door', 0, 0), ...slots]
  }
}
