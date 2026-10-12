import { browserStorage } from '../../office-live/browser-storage'

export const ROSTER_NAMES_STORAGE_KEY = 'claudewatch.office.roster-names'
const MAX_NAME_LENGTH = 40

type NameStorage = Pick<Storage, 'getItem'>

// `{ [themeId]: string[] }`, checked by shape: anything else reads as "no override".
function storedNames(storage: NameStorage | null, themeId: string): readonly unknown[] {
  let stored: unknown
  try {
    stored = JSON.parse(storage?.getItem(ROSTER_NAMES_STORAGE_KEY) ?? 'null')
  } catch {
    return []
  }
  if (typeof stored !== 'object' || stored === null || !Object.hasOwn(stored, themeId)) return []
  const names: unknown = Reflect.get(stored, themeId)
  return Array.isArray(names) ? names : []
}

// A character's displayed name: the owner's local rename when one is stored, else the shipped one.
export function rosterName(
  themeId: string,
  index: number,
  defaultName: string,
  storage: NameStorage | null = browserStorage()
): string {
  const name = storedNames(storage, themeId)[index]
  if (typeof name !== 'string') return defaultName
  return name.trim().slice(0, MAX_NAME_LENGTH) || defaultName
}
