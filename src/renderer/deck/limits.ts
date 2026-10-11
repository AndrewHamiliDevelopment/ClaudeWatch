import type { RateLimitWindow } from '../lib/types'
import { formatCountdown, secondsUntilReset } from '../lib/utils'

// Where a meter's fill runs hot and the words "Near limit" appear.
export const NEAR_LIMIT_PERCENT = 80

export interface LimitReading {
  percent: number
  text: string
  isNearLimit: boolean
}

export function readLimit(limitWindow: RateLimitWindow): LimitReading {
  const percent = Math.min(100, limitWindow.used_percentage)
  const secondsLeft = secondsUntilReset(limitWindow.resets_at)
  const timeLeft = secondsLeft > 0 ? `, ${formatCountdown(secondsLeft)} left` : ''
  return {
    percent,
    text: `${Math.round(percent)}%${timeLeft}`,
    isNearLimit: percent >= NEAR_LIMIT_PERCENT
  }
}
