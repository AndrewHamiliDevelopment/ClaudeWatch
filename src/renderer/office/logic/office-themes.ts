import { useSyncExternalStore } from 'react'
import type { FloorGeometry, RoomGeometry, ZoneGeometry } from '../scene-model'
import { getTheme, listThemes } from '../themes/registry'
import type { OfficeTheme } from '../themes/types'

export const OFFICE_THEMES_STORAGE_KEY = 'claudewatch.office.themes'
const STORAGE_VERSION = 1

type ThemeIdsByKey = Readonly<Record<string, string>>

export interface ThemeAssignments {
  version: typeof STORAGE_VERSION
  companies: ThemeIdsByKey
  projects: ThemeIdsByKey
}

export type ThemedZone = Pick<ZoneGeometry, 'companyKey' | 'projectKey'>
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem'>

// What one theme draws on a floor that mixes themes.
export interface ThemeZoneGroup {
  themeId: string
  companies: ZoneGeometry[]
  projects: ZoneGeometry[]
  rooms: RoomGeometry[]
}

export const EMPTY_THEME_ASSIGNMENTS: ThemeAssignments = {
  version: STORAGE_VERSION,
  companies: {},
  projects: {}
}

function isKnownTheme(themeId: string): boolean {
  return listThemes().some((theme) => theme.id === themeId)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Own members only: a key such as "constructor" must not read Object.prototype.
function assignedThemeId(themeIds: ThemeIdsByKey, key: string | null): string | undefined {
  return key !== null && Object.hasOwn(themeIds, key) ? themeIds[key] : undefined
}

// Project override, else the company's theme, else the floor's default.
export function resolveTheme(
  zone: ThemedZone,
  assignments: ThemeAssignments,
  defaultThemeId: string
): string {
  return (
    assignedThemeId(assignments.projects, zone.projectKey) ??
    assignedThemeId(assignments.companies, zone.companyKey) ??
    defaultThemeId
  )
}

const UNASSIGNED_ZONE: ThemedZone = { companyKey: null, projectKey: null }

// A project's leaf zones share their ids with the floor's rooms, so a room takes its project's theme.
export function groupZonesByTheme(
  floor: FloorGeometry,
  themeIdFor: (zone: ThemedZone) => string
): ThemeZoneGroup[] {
  const groups = new Map<string, ThemeZoneGroup>()
  const groupFor = (themeId: string): ThemeZoneGroup => {
    const existing = groups.get(themeId)
    if (existing) return existing
    const created: ThemeZoneGroup = { themeId, companies: [], projects: [], rooms: [] }
    groups.set(themeId, created)
    return created
  }
  const themeIdByRoom = new Map<string, string>()
  for (const company of floor.zones) {
    if (company.kind !== 'company') continue
    groupFor(themeIdFor(company)).companies.push(company)
    for (const project of company.children) {
      if (project.kind !== 'project') continue
      const themeId = themeIdFor(project)
      groupFor(themeId).projects.push(project)
      for (const leaf of project.children) themeIdByRoom.set(leaf.id, themeId)
    }
  }
  for (const room of floor.rooms)
    groupFor(themeIdByRoom.get(room.id) ?? themeIdFor(UNASSIGNED_ZONE)).rooms.push(room)
  return [...groups.values()]
}

function knownThemeIds(value: unknown): ThemeIdsByKey {
  if (!isRecord(value)) return {}
  return Object.fromEntries(
    Object.entries(value).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && isKnownTheme(entry[1])
    )
  )
}

// Stored settings are checked by shape: anything that is not a known theme id is dropped.
export function parseThemeAssignments(raw: string | null): ThemeAssignments {
  if (raw === null) return EMPTY_THEME_ASSIGNMENTS
  let stored: unknown
  try {
    stored = JSON.parse(raw)
  } catch {
    return EMPTY_THEME_ASSIGNMENTS
  }
  if (!isRecord(stored) || stored.version !== STORAGE_VERSION) return EMPTY_THEME_ASSIGNMENTS
  return {
    version: STORAGE_VERSION,
    companies: knownThemeIds(stored.companies),
    projects: knownThemeIds(stored.projects)
  }
}

type Scope = 'companies' | 'projects'

export interface OfficeThemeStore {
  getAssignments(): ThemeAssignments
  getThemeFor(zone: ThemedZone, defaultTheme: OfficeTheme): OfficeTheme
  setCompanyTheme(companyKey: string, themeId: string): void
  clearCompanyTheme(companyKey: string): void
  setProjectTheme(projectKey: string, themeId: string): void
  clearProjectTheme(projectKey: string): void
  subscribe(listener: () => void): () => void
}

export function createOfficeThemeStore(storage: ThemeStorage | null): OfficeThemeStore {
  const listeners = new Set<() => void>()
  let assignments = EMPTY_THEME_ASSIGNMENTS
  try {
    assignments = parseThemeAssignments(storage?.getItem(OFFICE_THEMES_STORAGE_KEY) ?? null)
  } catch {
    // A locked-down storage backend leaves every zone on the default theme.
  }

  const commit = (next: ThemeAssignments): void => {
    assignments = next
    try {
      storage?.setItem(OFFICE_THEMES_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // The choice still applies for this session when it cannot be saved.
    }
    for (const listener of listeners) listener()
  }
  const assign = (scope: Scope, key: string, themeId: string): void => {
    if (!key || !isKnownTheme(themeId) || assignedThemeId(assignments[scope], key) === themeId)
      return
    commit({ ...assignments, [scope]: { ...assignments[scope], [key]: themeId } })
  }
  const clear = (scope: Scope, key: string): void => {
    if (assignedThemeId(assignments[scope], key) === undefined) return
    const { [key]: _removed, ...kept } = assignments[scope]
    commit({ ...assignments, [scope]: kept })
  }

  return {
    getAssignments: () => assignments,
    getThemeFor: (zone, defaultTheme) => getTheme(resolveTheme(zone, assignments, defaultTheme.id)),
    setCompanyTheme: (companyKey, themeId) => assign('companies', companyKey, themeId),
    clearCompanyTheme: (companyKey) => clear('companies', companyKey),
    setProjectTheme: (projectKey, themeId) => assign('projects', projectKey, themeId),
    clearProjectTheme: (projectKey) => clear('projects', projectKey),
    subscribe: (listener) => {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    }
  }
}

function browserStorage(): ThemeStorage | null {
  try {
    return window.localStorage
  } catch {
    return null
  }
}

// dead-code-allowed: the theme picker in the Office HUD calls the setters 2026-12-31
export const officeThemes = createOfficeThemeStore(browserStorage())

export function useThemeAssignments(): ThemeAssignments {
  return useSyncExternalStore(officeThemes.subscribe, officeThemes.getAssignments)
}
