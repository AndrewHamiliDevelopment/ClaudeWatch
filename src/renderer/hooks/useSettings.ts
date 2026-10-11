import { useState, useEffect, useCallback } from 'react'
import type { AppSettings } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'
import { deckApi } from '../deck/deck-api'

interface UseSettingsReturn {
  settings: AppSettings
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>
  loading: boolean
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [loading, setLoading] = useState(() => Boolean(deckApi()))

  useEffect(() => {
    const api = deckApi()
    if (!api) {
      setLoading(false)
      return
    }

    api
      .getSettings()
      .then((data) => {
        setSettings(data)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [])

  const updateSettings = useCallback(async (partial: Partial<AppSettings>) => {
    const api = deckApi()
    if (!api) return

    const updated = await api.setSettings(partial)
    setSettings(updated)
  }, [])

  return { settings, updateSettings, loading }
}
