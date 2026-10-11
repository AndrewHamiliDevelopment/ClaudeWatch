import type { Point } from './path'

export interface Slot extends Point {
  id: string
  heading: number
}
export interface Bounds extends Point {
  width: number
  depth: number
  door: Point
}
export interface ZoneLayout extends Bounds {
  id: string
  kind: 'company' | 'project' | 'office' | 'team'
  label: string
  companyKey: string
  projectKey: string | null
  sessionKey: string | null
  capacity: number
  index: number
  releasedAtMs: number | null
  children: ZoneLayout[]
}
export interface RoomLayout extends ZoneLayout {
  kind: 'office' | 'team'
  worktree: string | null
  plate: number
  bay: number
  slots: Slot[]
}
export interface FloorLayout {
  id: string
  label: string
  width: number
  depth: number
  rooms: RoomLayout[]
  zones: ZoneLayout[]
  elevator: Slot
}

export function bounds(left: number, top: number, width: number, depth: number): Bounds {
  return {
    x: left + width / 2,
    z: top + depth / 2,
    width,
    depth,
    door: { x: left + width / 2, z: top }
  }
}

export function room(
  project: ZoneLayout,
  bay: number,
  sessionKey: string | null,
  label: string,
  worktree: string | null,
  seats = 0
): RoomLayout {
  const left = project.x - project.width / 2
  const top = project.z - project.depth / 2
  const isTeam = sessionKey === null
  const rows = project.capacity / 4
  const geometry = isTeam
    ? bounds(left + 1, top + 3 + rows * 6, 20, Math.max(4, Math.ceil(seats / 8) * 2 + 2))
    : bounds(left + 1 + (bay % 4) * 5, top + 3 + Math.floor(bay / 4) * 6, 4, 4)
  const slot = (id: string, x: number, z: number): Slot => ({ id, x, z, heading: Math.PI })
  const slots = isTeam
    ? Array.from({ length: seats }, (_, index) =>
        slot(
          `team_seat_${index}`,
          left + 3 + (index % 8) * 2,
          geometry.door.z + 2 + Math.floor(index / 8) * 2
        )
      )
    : [
        slot('desk_main', geometry.x, geometry.z + 0.5),
        slot('desk_guest_0', geometry.x - 1, geometry.z - 0.5),
        slot('desk_guest_1', geometry.x + 1, geometry.z - 0.5)
      ]
  return {
    ...geometry,
    id: isTeam ? `${project.id}:team` : `${project.id}:office:${bay}`,
    kind: isTeam ? 'team' : 'office',
    label,
    companyKey: project.companyKey,
    projectKey: project.projectKey,
    sessionKey,
    worktree,
    plate: 0,
    bay,
    capacity: isTeam ? seats : 1,
    index: bay,
    releasedAtMs: null,
    children: [],
    slots: [slot('door', geometry.door.x, geometry.door.z), ...slots]
  }
}
