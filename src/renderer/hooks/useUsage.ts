import { useState, useEffect, useCallback } from 'react'
import type { UsageStats } from '../lib/types'

interface UseUsageReturn {
  usage: UsageStats | null
  loading: boolean
  refresh: () => void
}

export function useUsage(): UseUsageReturn {
  const [usage, setUsage] = useState<UsageStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!window.api?.getUsage) {
      setLoading(false)
      return
    }

    window.api.getUsage().then((data) => {
      if (data) setUsage(data)
      setLoading(false)
    })

    const cleanup = window.api.onUsageUpdate((data: UsageStats) => {
      setUsage(data)
      setLoading(false)
    })

    return cleanup
  }, [])

  const refresh = useCallback(() => {
    if (!window.api?.refreshUsage) return
    setLoading(true)
    window.api.refreshUsage().then((data) => {
      if (data) setUsage(data)
      setLoading(false)
    })
  }, [])

  return { usage, loading, refresh }
}
