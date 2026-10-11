import { brassWorkshop, neoEdoSteam } from './builtins'
import type { OfficeTheme } from './types'

export const DEFAULT_THEME_ID = 'neo-edo-steam'
const themes = new Map<string, OfficeTheme>()

export function registerTheme(theme: OfficeTheme): void {
  if (themes.has(theme.id)) throw new Error(`Theme ${theme.id} already registered`)
  themes.set(theme.id, theme)
}

registerTheme(neoEdoSteam)
registerTheme(brassWorkshop)

export function getTheme(id: string): OfficeTheme {
  return themes.get(id) ?? neoEdoSteam
}

export function listThemes(): OfficeTheme[] {
  return Array.from(themes.values())
}

export function themeForTeam(_teamId?: string): OfficeTheme {
  return getTheme(DEFAULT_THEME_ID)
}
