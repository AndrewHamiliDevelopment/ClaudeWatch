import type { SessionRef } from '../../shared/office/types'
import { bounds, type FloorLayout, type ZoneLayout } from './rooms'
import { packCompanies, RESERVATION_MS } from './allocation'
import { populateRooms, positionProjects, refreshProjects } from './projects'
export type { FloorLayout, RoomLayout, Slot, ZoneLayout } from './rooms'

export interface LayoutMap {
  version: 1
  floors: FloorLayout[]
  reservations: Record<
    string,
    {
      floorId: string
      plate: number
      bay: number
      companyKey: string
      projectKey: string
      releasedAtMs: number | null
    }
  >
}

export function buildLayout(
  sessions: SessionRef[],
  saved: LayoutMap | undefined,
  nowMs: number
): LayoutMap {
  // Older persisted maps used one floor per project and cannot preserve the new hierarchy.
  const layout: LayoutMap = saved?.floors[0]?.zones
    ? structuredClone(saved)
    : { version: 1, floors: [], reservations: {} }
  const ordered = [...sessions].sort(
    (a, b) =>
      a.companyKey.localeCompare(b.companyKey) ||
      a.projectKey.localeCompare(b.projectKey) ||
      a.key.localeCompare(b.key)
  )
  const active = new Map(ordered.map((s) => [s.key, s]))
  for (const [key, reservation] of Object.entries(layout.reservations)) {
    const current = active.get(key)
    if (
      current &&
      (current.companyKey !== reservation.companyKey ||
        current.projectKey !== reservation.projectKey)
    ) {
      delete layout.reservations[key]
      continue
    }
    if (current) reservation.releasedAtMs = null
    else reservation.releasedAtMs ??= nowMs
    if (reservation.releasedAtMs !== null && nowMs - reservation.releasedAtMs >= RESERVATION_MS)
      delete layout.reservations[key]
  }
  const floor = layout.floors[0] ?? {
    id: 'hq',
    label: 'Headquarters',
    width: 12,
    depth: 12,
    rooms: [],
    zones: [],
    elevator: { id: 'entrance', x: 0, z: 0, heading: 0 }
  }
  layout.floors = [floor]
  floor.label =
    new Set(ordered.map((s) => s.projectKey)).size === 1 ? ordered[0].projectLabel : 'Headquarters'
  const previousProjects = new Set(floor.zones.flatMap((c) => c.children.map((p) => p.id)))
  const activeCompanies = new Set(ordered.map((s) => s.companyKey))
  floor.zones = floor.zones.filter((company) => {
    if (activeCompanies.has(company.companyKey)) company.releasedAtMs = null
    else company.releasedAtMs ??= nowMs
    return company.releasedAtMs === null || nowMs - company.releasedAtMs < RESERVATION_MS
  })
  for (const session of ordered) {
    if (floor.zones.some((c) => c.companyKey === session.companyKey)) continue
    const company: ZoneLayout = {
      ...bounds(0, 0, 63, 87),
      id: `company:${session.companyKey}`,
      kind: 'company',
      label: session.companyLabel,
      companyKey: session.companyKey,
      projectKey: null,
      sessionKey: null,
      capacity: 4,
      index: -1,
      releasedAtMs: null,
      children: []
    }
    floor.zones.push(company)
  }
  floor.zones.sort((a, b) => a.id.localeCompare(b.id))
  for (const company of floor.zones) {
    const members = ordered.filter((s) => s.companyKey === company.companyKey)
    if (members.length) company.label = members[0].companyLabel
    refreshProjects(company, members, layout, nowMs)
    positionProjects(company, previousProjects)
  }
  packCompanies(floor.zones)
  floor.rooms = floor.zones.flatMap((company) => {
    company.door = { x: company.x - company.width / 2 + 1.5, z: company.z - company.depth / 2 }
    positionProjects(company, previousProjects)
    return populateRooms(
      company,
      ordered.filter((s) => s.companyKey === company.companyKey),
      layout
    )
  })
  floor.width = Math.max(
    floor.width,
    12,
    ...floor.zones.map((c) => 2 * (Math.abs(c.x) + c.width / 2 + 3))
  )
  floor.depth = Math.max(
    floor.depth,
    12,
    ...floor.zones.map((c) => 2 * (Math.abs(c.z) + c.depth / 2 + 3))
  )
  return layout
}
