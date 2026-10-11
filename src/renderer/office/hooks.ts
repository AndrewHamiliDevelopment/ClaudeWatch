import { useCallback, useEffect, useState } from 'react'

import { listThemes, themeForTeam } from './themes/registry'

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

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

const THEME_STORAGE_KEY = 'claudewatch.office.theme'

export function useOfficeTheme() {
  const [hasChosenTheme, setHasChosenTheme] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY)
      return listThemes().find((candidate) => candidate.id === stored) ?? themeForTeam()
    } catch {
      return themeForTeam()
    }
  })
  useEffect(() => {
    if (!hasChosenTheme) return
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme.id)
    } catch {
      // A locked-down storage backend must not disable the office controls.
    }
  }, [theme.id, hasChosenTheme])
  const cycleTheme = useCallback(() => {
    setHasChosenTheme(true)
    setTheme((current) => {
      const themes = listThemes()
      return themes[
        (themes.findIndex((candidate) => candidate.id === current.id) + 1) % themes.length
      ]
    })
  }, [])
  return { theme, cycleTheme }
}
