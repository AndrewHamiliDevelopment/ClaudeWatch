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
// An open seating area in a company's grounds: no walls, so the path grid walks straight in.
export interface LoungeLayout extends Bounds {
  id: string
  slots: Slot[]
}
export interface ZoneLayout extends Bounds {
  id: string
  kind: 'company' | 'project' | 'office' | 'team'
  label: string
  companyKey: string
  projectKey: string | null
  sessionKey: string | null
  capacity: number
  // Order only: a company's side of the street and place in its row, a project's place in its
  // company. No size or position is ever read back from it.
  index: number
  children: ZoneLayout[]
  // Company zones only.
  lounge?: LoungeLayout
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

export const LOUNGE_WIDTH = 6
const LOUNGE_SEATS_PER_ROW = 4

export function bounds(left: number, top: number, width: number, depth: number): Bounds {
  return {
    x: left + width / 2,
    z: top + depth / 2,
    width,
    depth,
    door: { x: left + width / 2, z: top }
  }
}

export function teamDepth(seats: number): number {
  return Math.max(4, Math.ceil(seats / 8) * 2 + 2)
}

export function loungeDepth(seats: number): number {
  return 3 + Math.ceil(seats / LOUNGE_SEATS_PER_ROW) * 2
}

export function lounge(companyId: string, left: number, top: number, seats: number): LoungeLayout {
  return {
    ...bounds(left, top, LOUNGE_WIDTH, loungeDepth(seats)),
    id: `${companyId}:lounge`,
    // Seats face +z like desk seats, in rows of four.
    slots: Array.from({ length: seats }, (_, index) => ({
      id: `lounge_seat_${index}`,
      x: left + 1.125 + (index % LOUNGE_SEATS_PER_ROW) * 1.25,
      z: top + 2 + Math.floor(index / LOUNGE_SEATS_PER_ROW) * 2,
      heading: 0
    }))
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
    ? bounds(left + 1, top + 3 + rows * 6, 20, teamDepth(seats))
    : bounds(left + 1 + (bay % 4) * 5, top + 3 + Math.floor(bay / 4) * 6, 4, 4)
  // Seats face +z, toward the default camera; the scene draws each desk 0.62 m in front of
  // its seat, so every seat keeps that strip clear of walls and of the other seats.
  const slot = (id: string, x: number, z: number): Slot => ({ id, x, z, heading: 0 })
  const slots = isTeam
    ? Array.from({ length: seats }, (_, index) =>
        slot(
          `team_seat_${index}`,
          left + 3 + (index % 8) * 2,
          geometry.door.z + 2 + Math.floor(index / 8) * 2
        )
      )
    : [
        slot('desk_main', geometry.x, geometry.z + 0.3),
        slot('desk_guest_0', geometry.x - 1.15, geometry.z - 0.95),
        slot('desk_guest_1', geometry.x + 1.15, geometry.z - 0.95)
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
    children: [],
    slots: [slot('door', geometry.door.x, geometry.door.z), ...slots]
  }
}
