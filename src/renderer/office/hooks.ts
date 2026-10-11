import { useCallback, useEffect, useState } from 'react'

import { readStored, writeStored } from '../office-live/browser-storage'
import { officeThemes, resolveTheme, useThemeAssignments } from './logic/office-themes'
import type { ZoneGeometry } from './scene-model'
import { getTheme, listThemes, themeForTeam } from './themes/registry'
import type { OfficeTheme } from './themes/types'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

export function usePrefersReducedMotion(): boolean {
  const [isReduced, setIsReduced] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION_QUERY).matches
  )
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return
    const query = window.matchMedia(REDUCED_MOTION_QUERY)
    const update = (): void => setIsReduced(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return isReduced
}

const THEME_STORAGE_KEY = 'claudewatch.office.theme'

function themeAfter(themeId: string): OfficeTheme {
  const themes = listThemes()
  return themes[(themes.findIndex((candidate) => candidate.id === themeId) + 1) % themes.length]
}

// A project zone carries its company's key too, so the project key decides which it is.
function assignNextTheme(zone: ZoneGeometry, currentThemeId: string): void {
  const nextId = themeAfter(currentThemeId).id
  if (zone.projectKey) officeThemes.setProjectTheme(zone.projectKey, nextId)
  else if (zone.companyKey) officeThemes.setCompanyTheme(zone.companyKey, nextId)
}

// `theme` is the office default. Cycling changes the focused company or project when there
// is one, and the default otherwise; `cycled` is whichever of the two the next cycle changes.
export function useOfficeTheme(focusedZone?: ZoneGeometry) {
  const assignments = useThemeAssignments()
  const [hasChosenTheme, setHasChosenTheme] = useState(false)
  const [theme, setTheme] = useState(() => {
    const stored = readStored(THEME_STORAGE_KEY)
    return listThemes().find((candidate) => candidate.id === stored) ?? themeForTeam()
  })
  useEffect(() => {
    if (!hasChosenTheme) return
    writeStored(THEME_STORAGE_KEY, theme.id)
  }, [theme.id, hasChosenTheme])

  const zoneThemeId = focusedZone ? resolveTheme(focusedZone, assignments, theme.id) : null
  const cycleTheme = useCallback(() => {
    if (focusedZone && zoneThemeId) return assignNextTheme(focusedZone, zoneThemeId)
    setHasChosenTheme(true)
    setTheme((current) => themeAfter(current.id))
  }, [focusedZone, zoneThemeId])

  return {
    theme,
    cycleTheme,
    cycled: {
      scope: focusedZone?.label ?? null,
      theme: zoneThemeId ? getTheme(zoneThemeId) : theme
    }
  }
}
