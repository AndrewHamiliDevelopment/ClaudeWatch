import { useState, useEffect, useRef } from 'react'
import type { PromoStatus } from '../lib/types'

interface UsePromoStatusReturn {
  promo: PromoStatus | null
}

export function usePromoStatus(): UsePromoStatusReturn {
  const [promo, setPromo] = useState<PromoStatus | null>(null)
  const countdownRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!window.api?.getPromoStatus) return

    window.api.getPromoStatus().then((data) => {
      if (data) setPromo(data)
    })

    const cleanup = window.api.onPromoUpdate((data: PromoStatus) => {
      setPromo(data)
    })

    return cleanup
  }, [])

  // Local countdown timer for smooth UI
  useEffect(() => {
    if (countdownRef.current) {
      clearInterval(countdownRef.current)
      countdownRef.current = null
    }

    if (!promo?.is2x || promo.expiresInSeconds == null) return

    countdownRef.current = setInterval(() => {
      setPromo((prev) => {
        if (!prev || prev.expiresInSeconds == null || prev.expiresInSeconds <= 0) return prev
        return { ...prev, expiresInSeconds: prev.expiresInSeconds - 1 }
      })
    }, 1000)

    return () => {
      if (countdownRef.current) {
        clearInterval(countdownRef.current)
        countdownRef.current = null
      }
    }
  }, [promo?.is2x, promo?.currentWindowEnd])

  return { promo }
}
