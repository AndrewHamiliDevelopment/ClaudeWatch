import type { SessionRef } from '../../shared/office/types'
import { bounds, room, type ZoneLayout, type RoomLayout } from './rooms'
import {
  nextBay,
  overlaps,
  reserveCapacity,
  RESERVATION_MS,
  PROJECT_STRIDE_X,
  PROJECT_STRIDE_Z
} from './allocation'
import type { LayoutMap } from './layout'

export function refreshProjects(
  company: ZoneLayout,
  sessions: SessionRef[],
  layout: LayoutMap,
  now: number
): void {
  const active = new Set(sessions.map((s) => s.projectKey))
  company.children = company.children.filter((project) => {
    if (active.has(project.projectKey!)) project.releasedAtMs = null
    else project.releasedAtMs ??= now
    return project.releasedAtMs === null || now - project.releasedAtMs < RESERVATION_MS
  })
  for (const session of sessions) {
    if (company.children.some((p) => p.projectKey === session.projectKey)) continue
    company.children.push({
      ...bounds(0, 0, 24, 18),
      id: `${company.id}:project:${session.projectKey}`,
      kind: 'project',
      label: session.projectLabel,
      companyKey: company.companyKey,
      projectKey: session.projectKey,
      sessionKey: null,
      index: nextBay(company.children.map((p) => p.index)),
      capacity: 4,
      releasedAtMs: null,
      children: []
    })
  }
  company.children.sort((a, b) => a.id.localeCompare(b.id))
  for (const project of company.children) {
    const members = sessions.filter((s) => s.projectKey === project.projectKey)
    const reserved = Object.values(layout.reservations).filter(
      (r) => r.companyKey === company.companyKey && r.projectKey === project.projectKey
    )
    for (const member of members) {
      if (layout.reservations[member.key]) continue
      const bay = nextBay(reserved.map((r) => r.bay))
      const reservation = {
        floorId: 'hq',
        plate: 0,
        bay,
        companyKey: company.companyKey,
        projectKey: member.projectKey,
        releasedAtMs: null
      }
      reserved.push(reservation)
      layout.reservations[member.key] = reservation
    }
    project.capacity = reserveCapacity(
      Math.max(0, ...reserved.map((r) => r.bay + 1)),
      project.capacity
    )
    const overflow = members.reduce((count, s) => count + Math.max(0, s.subagents.length - 2), 0)
    const seats = Math.max(8, Math.ceil(overflow / 8) * 8)
    const teamDepth = Math.max(4, Math.ceil(seats / 8) * 2 + 2)
    project.depth = Math.max(project.depth, (project.capacity / 4) * 6 + 4 + teamDepth)
    if (members.length) project.label = members[0].projectLabel
  }
}

export function positionProjects(company: ZoneLayout, previous = new Set<string>()): void {
  const left = company.x - company.width / 2
  const top = company.z - company.depth / 2
  const placed: ZoneLayout[] = []
  const ordered = [...company.children].sort(
    (a, b) => Number(previous.has(b.id)) - Number(previous.has(a.id)) || a.index - b.index
  )
  for (const project of ordered) {
    let index = project.index
    while (true) {
      const geometry = bounds(
        left + 3 + (index % 2) * PROJECT_STRIDE_X,
        top + 3 + Math.floor(index / 2) * PROJECT_STRIDE_Z,
        project.width,
        project.depth
      )
      if (!placed.some((p) => overlaps(p, geometry, 3))) {
        Object.assign(project, geometry, { index })
        placed.push(project)
        break
      }
      index++
    }
  }
  company.depth = Math.max(company.depth, ...placed.map((p) => p.z + p.depth / 2 - top + 3))
  company.z = top + company.depth / 2
}

export function populateRooms(
  company: ZoneLayout,
  sessions: SessionRef[],
  layout: LayoutMap
): RoomLayout[] {
  return company.children.flatMap((project) => {
    const members = sessions.filter((s) => s.projectKey === project.projectKey)
    const offices = members.map((s) =>
      room(project, layout.reservations[s.key].bay, s.key, s.name, s.worktree)
    )
    const overflow = members.reduce((count, s) => count + Math.max(0, s.subagents.length - 2), 0)
    const team = room(
      project,
      -1,
      null,
      `${project.label} team`,
      null,
      Math.max(8, Math.ceil(overflow / 8) * 8)
    )
    project.children = [...offices, team]
    return [...offices, team]
  })
}
