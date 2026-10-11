import { DEFAULT_SETTINGS, type AppSettings } from '../renderer/lib/types'

const THEMES: readonly unknown[] = ['dark', 'light', 'system']

function hasShapeOf(value: unknown, standard: unknown): boolean {
  if (Array.isArray(standard)) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
  }
  if (typeof standard === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (typeof standard === 'object' && standard !== null) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
  return typeof value === typeof standard
}

function knownEntries(value: object, defaults: object): [string, unknown][] {
  const standard = defaults as Record<string, unknown>
  return Object.entries(value).filter(
    ([key, entry]) => Object.hasOwn(standard, key) && hasShapeOf(entry, standard[key])
  )
}

// Keeps only known settings that have the shape of their default. Used on the way in (IPC) and
// on the way out (the stored file): the app boots from these values, so a null group, a NaN
// interval or a "false" string must never be acted on.
export function conformSettings(data: unknown): Partial<AppSettings> {
  if (typeof data !== 'object' || data === null) return {}
  const settings = Object.fromEntries(knownEntries(data, DEFAULT_SETTINGS)) as Partial<AppSettings>
  if (settings.notifications) {
    settings.notifications = Object.fromEntries(
      knownEntries(settings.notifications, DEFAULT_SETTINGS.notifications)
    ) as AppSettings['notifications']
  }
  if (!THEMES.includes(settings.theme)) delete settings.theme
  return settings
}
