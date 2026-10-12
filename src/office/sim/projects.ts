import type { SessionRef } from '../../shared/office/types'
import { assignBays, packGrounds, reserveCapacity, type Grounds } from './allocation'
import {
  bounds,
  lounge,
  LOUNGE_WIDTH,
  loungeDepth,
  room,
  teamDepth,
  type RoomLayout,
  type ZoneLayout
} from './rooms'
import type { LayoutMap } from './layout'

const PROJECT_WIDTH = 24
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

function teamSeats(crew: SessionRef[]): number {
  const overflow = crew.reduce((count, s) => count + Math.max(0, s.subagents.length - 2), 0)
  return Math.max(8, Math.ceil(overflow / 8) * 8)
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
    const capacity = reserveCapacity(crew.length)
    return {
      ...bounds(0, 0, PROJECT_WIDTH, (capacity / 4) * 6 + 4 + teamDepth(teamSeats(crew))),
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
  const grounds = packGrounds(projects, { width: LOUNGE_WIDTH, depth: loungeDepth(loungeSeats) })
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
  zone.lounge = lounge(zone.id, left + grounds.lounge.x, top + grounds.lounge.z, loungeSeats)
  for (const project of zone.children) {
    const corner = grounds.projects[project.index]
    Object.assign(project, bounds(left + corner.x, top + corner.z, project.width, project.depth))
  }
  zone.children.sort((a, b) => a.id.localeCompare(b.id))
  return zone.children.flatMap((project) => {
    const crew = members.filter((s) => s.projectKey === project.projectKey)
    const offices = crew.map((s) =>
      room(project, reservations[s.key].bay, s.key, s.name, s.worktree)
    )
    const team = room(project, -1, null, `${project.label} team`, null, teamSeats(crew))
    project.children = [...offices, team]
    return [...offices, team]
  })
}
