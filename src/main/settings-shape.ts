import { DEFAULT_SETTINGS, type AppSettings } from '../renderer/lib/types'
import { clamp } from '../shared/range'
import { COOLDOWN_SECONDS_RANGE, SETTING_RANGES } from '../shared/settings-ranges'

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
  const standard = new Map<string, unknown>(Object.entries(defaults))
  return Object.entries(value).filter(
    ([key, entry]) => standard.has(key) && hasShapeOf(entry, standard.get(key))
  )
}

// Keeps only known settings that have the shape of their default, with numbers inside their
// range. Used on the way in (IPC) and on the way out (the stored file): the app boots from
// these values, so a null group, a NaN or 1 ms interval, or a "false" string is never acted on.
export function conformSettings(data: unknown): Partial<AppSettings> {
  if (typeof data !== 'object' || data === null) return {}
  const settings = Object.fromEntries(knownEntries(data, DEFAULT_SETTINGS)) as Partial<AppSettings>
  if (settings.notifications) {
    settings.notifications = Object.fromEntries(
      knownEntries(settings.notifications, DEFAULT_SETTINGS.notifications)
    ) as AppSettings['notifications']
  }
  if (!THEMES.includes(settings.theme)) delete settings.theme
  for (const key of Object.keys(SETTING_RANGES) as (keyof typeof SETTING_RANGES)[]) {
    const value = settings[key]
    if (value !== undefined) settings[key] = clamp(value, SETTING_RANGES[key])
  }
  if (settings.notifications?.cooldownSeconds !== undefined) {
    settings.notifications.cooldownSeconds = clamp(
      settings.notifications.cooldownSeconds,
      COOLDOWN_SECONDS_RANGE
    )
  }
  return settings
}
