import type { SessionRef } from '../../shared/office/types'
import { assignBays, packGrounds, reserveCapacity, type Grounds } from './allocation'
import {
  bounds,
  lounge,
  LOUNGE_WIDTH,
  loungeDepth,
  planProject,
  room,
  type RoomLayout,
  type ZoneLayout
} from './rooms'
import type { LayoutMap } from './layout'

const UNSAVED = -1

// A company sized from its live sessions, not yet placed on the floor.
export interface CompanyDraft {
  zone: ZoneLayout
  members: SessionRef[]
  grounds: Grounds
  loungeSeats: number
  reservations: LayoutMap['reservations']
}

// Saved maps come from storage: only a whole, non-negative number counts as an order or a bay.
const isOrdinal = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0

// One seat per subagent past the two guest desks.
function teamSeats(crew: SessionRef[]): number {
  return crew.reduce((count, s) => count + Math.max(0, s.subagents.length - 2), 0)
}

function heldBays(crew: SessionRef[], saved: LayoutMap | undefined): Map<string, number> {
  const held = new Map<string, number>()
  for (const { key, companyKey, projectKey } of crew) {
    const reservation = saved?.reservations?.[key]
    if (
      reservation?.companyKey === companyKey &&
      reservation.projectKey === projectKey &&
      isOrdinal(reservation.bay)
    )
      held.set(key, reservation.bay)
  }
  return held
}

// `members` are one company's sessions, sorted by project and key.
export function draftCompany(members: SessionRef[], saved: LayoutMap | undefined): CompanyDraft {
  const [{ companyKey, companyLabel }] = members
  const id = `company:${companyKey}`
  const zones = saved?.floors?.[0]?.zones
  const previous = Array.isArray(zones) ? zones.find((zone) => zone.id === id) : undefined
  const savedIndex = previous?.index
  const savedProjects = previous?.children
  const savedOrder = new Map(
    (Array.isArray(savedProjects) ? savedProjects : [])
      .filter((project) => isOrdinal(project.index))
      .map((project) => [project.projectKey, project.index])
  )
  const rank = (projectKey: string): number => savedOrder.get(projectKey) ?? Number.MAX_SAFE_INTEGER
  // Projects keep the order they arrived in; the ones that left close up.
  const projectKeys = [...new Set(members.map((s) => s.projectKey))].sort(
    (a, b) => rank(a) - rank(b) || a.localeCompare(b)
  )
  const reservations: LayoutMap['reservations'] = {}
  const projects = projectKeys.map((projectKey, index): ZoneLayout => {
    const crew = members.filter((s) => s.projectKey === projectKey)
    const bays = assignBays(
      crew.map((s) => s.key),
      heldBays(crew, saved)
    )
    for (const [key, bay] of bays)
      reservations[key] = { floorId: 'hq', plate: 0, bay, companyKey, projectKey }
    const { width, depth, capacity } = planProject(crew.length, teamSeats(crew))
    return {
      ...bounds(0, 0, width, depth),
      id: `${id}:project:${projectKey}`,
      kind: 'project',
      label: crew[0].projectLabel,
      companyKey,
      projectKey,
      sessionKey: null,
      capacity,
      index,
      children: []
    }
  })
  const loungeSeats = reserveCapacity(members.reduce((n, s) => n + 1 + s.subagents.length, 0))
  // The lounge is the last box, so it never takes a project's place.
  const grounds = packGrounds([
    ...projects,
    { width: LOUNGE_WIDTH, depth: loungeDepth(loungeSeats) }
  ])
  return {
    zone: {
      ...bounds(0, 0, grounds.width, grounds.depth),
      id,
      kind: 'company',
      label: companyLabel,
      companyKey,
      projectKey: null,
      sessionKey: null,
      capacity: projects.reduce((desks, project) => desks + project.capacity, 0),
      index: isOrdinal(savedIndex) ? savedIndex : UNSAVED,
      children: projects
    },
    members,
    grounds,
    loungeSeats,
    reservations
  }
}

// Once the company has its place on the floor: puts its projects, lounge and rooms on the map.
export function settleCompany(draft: CompanyDraft): RoomLayout[] {
  const { zone, members, grounds, loungeSeats, reservations } = draft
  const left = zone.x - zone.width / 2
  const top = zone.z - zone.depth / 2
  zone.door = { x: left + 1.5, z: top }
  // A company north of the street is held by its south edge, so its shelves are measured from
  // there: when it deepens, what already stands in it stays where it is.
  const growsNorth = zone.z < 0
  const topOf = (corner: { z: number }, depth: number): number =>
    top + (growsNorth ? zone.depth - corner.z - depth : corner.z)
  const loungeCorner = grounds.corners[zone.children.length]
  zone.lounge = lounge(
    zone.id,
    left + loungeCorner.x,
    topOf(loungeCorner, loungeDepth(loungeSeats)),
    loungeSeats,
    growsNorth
  )
  for (const project of zone.children) {
    const corner = grounds.corners[project.index]
    Object.assign(
      project,
      bounds(left + corner.x, topOf(corner, project.depth), project.width, project.depth)
    )
  }
  zone.children.sort((a, b) => a.id.localeCompare(b.id))
  return zone.children.flatMap((project) => {
    const crew = members.filter((s) => s.projectKey === project.projectKey)
    const offices = crew.map((s) =>
      room(project, reservations[s.key].bay, s.key, s.name, s.worktree, { growsNorth })
    )
    const seats = teamSeats(crew)
    const { teamSeatsPerRow: seatsPerRow } = planProject(crew.length, seats)
    const team = seats
      ? [
          room(project, -1, null, `${project.label} team`, null, {
            growsNorth,
            seats,
            seatsPerRow
          })
        ]
      : []
    const leaves = [...offices, ...team]
    project.children = leaves
    return leaves
  })
}
