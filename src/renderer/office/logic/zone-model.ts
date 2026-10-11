import type { AgentView, SessionRef } from '../../../shared/office/types'
import type { FloorGeometry, OfficeFrame, ZoneGeometry } from '../scene-model'
import { needsHuman, sessionForAgent } from './floor-model'
import { doorSignPlacement, roomWallSegments, type WallSegment } from './room-layout'

export interface OfficeProjectRow {
  projectKey: string
  label: string
  zoneId: string | null
  agentCount: number
  attentionCount: number
}

export interface OfficeCompanyRow {
  companyKey: string
  label: string
  zoneId: string | null
  agentCount: number
  attentionCount: number
  projects: OfficeProjectRow[]
}

export interface CompanyListEntry {
  companyKey: string
  label: string
  projects: { projectKey: string; label: string; agents: AgentView[] }[]
}

function allZones(zones: readonly ZoneGeometry[]): ZoneGeometry[] {
  return zones.flatMap((zone) => [zone, ...allZones(zone.children)])
}

export function findZone(floor: FloorGeometry, zoneId: string): ZoneGeometry | undefined {
  return allZones(floor.zones).find((zone) => zone.id === zoneId)
}

const SIGN_OFFSET_M = 0.1
export const COMPANY_GATE_WIDTH = 3.2
export const PROJECT_DOOR_WIDTH = 1.6

function doorOf(zone: ZoneGeometry): { x: number; z: number } {
  return zone.door ?? { x: zone.x, z: zone.z + zone.depth / 2 }
}

// Perimeter walls with one opening: a wide gate for a company, a door for a project office.
export function zoneWalls(zone: ZoneGeometry): WallSegment[] {
  const gap = zone.kind === 'company' ? COMPANY_GATE_WIDTH : PROJECT_DOOR_WIDTH
  return roomWallSegments({ ...zone, door: doorOf(zone) }, gap)
}

// Signs face out of the zone at its door; a doorless zone gets its sign on the front (+z) edge.
export function zoneSignPlacement(zone: ZoneGeometry): { x: number; z: number; rotationY: number } {
  if (zone.door) return doorSignPlacement({ ...zone, door: zone.door })
  return { x: zone.x, z: zone.z + zone.depth / 2 + SIGN_OFFSET_M, rotationY: 0 }
}

interface Grouped {
  companyKey: string
  companyLabel: string
  projectKey: string
  projectLabel: string
  agents: AgentView[]
  sessions: SessionRef[]
}

// Sessions carry the company and project; agents reach their session through their room.
function groupByProject(frame: OfficeFrame): Map<string, Grouped> {
  const groups = new Map<string, Grouped>()
  const groupFor = (session: SessionRef): Grouped => {
    const existing = groups.get(session.projectKey)
    if (existing) return existing
    const created: Grouped = {
      companyKey: session.companyKey,
      companyLabel: session.companyLabel,
      projectKey: session.projectKey,
      projectLabel: session.projectLabel,
      agents: [],
      sessions: []
    }
    groups.set(session.projectKey, created)
    return created
  }
  for (const session of frame.sessions) groupFor(session).sessions.push(session)
  for (const agent of frame.agents) {
    const session = sessionForAgent(frame, agent)
    if (session) groupFor(session).agents.push(agent)
  }
  return groups
}

function projectRow(
  projectKey: string,
  label: string,
  zoneId: string | null,
  group?: Grouped
): OfficeProjectRow {
  return {
    projectKey,
    label,
    zoneId,
    agentCount: group?.agents.length ?? 0,
    attentionCount: group?.sessions.filter(needsHuman).length ?? 0
  }
}

function sum(rows: readonly OfficeProjectRow[], field: 'agentCount' | 'attentionCount'): number {
  return rows.reduce((total, row) => total + row[field], 0)
}

// Company › Project for the Offices panel: zones give the order and fly-to targets; sessions
// whose project has no zone yet are still listed so nothing is hidden.
export function buildOfficesTree(frame: OfficeFrame): OfficeCompanyRow[] {
  const groups = groupByProject(frame)
  const seenProjects = new Set<string>()
  const companies = new Map<string, OfficeCompanyRow>()

  for (const zone of frame.floors.flatMap((floor) => floor.zones)) {
    if (zone.kind !== 'company') continue
    const projects = zone.children
      .filter((child) => child.kind === 'project' && child.projectKey)
      .map((child) => {
        const projectKey = child.projectKey ?? child.id
        seenProjects.add(projectKey)
        return projectRow(projectKey, child.label, child.id, groups.get(projectKey))
      })
    const companyKey = zone.companyKey ?? zone.id
    companies.set(companyKey, {
      companyKey,
      label: zone.label,
      zoneId: zone.id,
      agentCount: 0,
      attentionCount: 0,
      projects
    })
  }

  for (const group of groups.values()) {
    if (seenProjects.has(group.projectKey)) continue
    const company =
      companies.get(group.companyKey) ??
      ({
        companyKey: group.companyKey,
        label: group.companyLabel,
        zoneId: null,
        agentCount: 0,
        attentionCount: 0,
        projects: []
      } satisfies OfficeCompanyRow)
    company.projects.push(projectRow(group.projectKey, group.projectLabel, null, group))
    companies.set(group.companyKey, company)
  }

  return [...companies.values()].map((company) => ({
    ...company,
    agentCount: sum(company.projects, 'agentCount'),
    attentionCount: sum(company.projects, 'attentionCount')
  }))
}

// Main agent first, each followed by its own subagents.
function orderAgents(frame: OfficeFrame, agents: readonly AgentView[]): AgentView[] {
  const bySession = (agent: AgentView): string =>
    sessionForAgent(frame, agent)?.key ?? agent.agentKey
  return [...agents].sort(
    (a, b) =>
      bySession(a).localeCompare(bySession(b)) ||
      Number(a.isSubagent) - Number(b.isSubagent) ||
      a.label.localeCompare(b.label)
  )
}

export function buildCompanyList(frame: OfficeFrame): CompanyListEntry[] {
  const groups = groupByProject(frame)
  return buildOfficesTree(frame)
    .map((company) => ({
      companyKey: company.companyKey,
      label: company.label,
      projects: company.projects
        .map((project) => ({
          projectKey: project.projectKey,
          label: project.label,
          agents: orderAgents(frame, groups.get(project.projectKey)?.agents ?? [])
        }))
        .filter((project) => project.agents.length > 0)
    }))
    .filter((company) => company.projects.length > 0)
}
