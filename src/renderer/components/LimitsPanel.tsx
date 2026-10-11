import { useEffect, useState } from 'react'
import type { RateLimits, UsageStats } from '../lib/types'
import { timeAgo } from '../lib/utils'
import { PLATE_TITLE_CLASS } from './deck/deck-styles'
import { LimitLines } from './deck/LimitLines'

interface LimitsPanelProps {
  usage: UsageStats | null
  rateLimits: RateLimits | null
}

export function LimitsPanel({ usage, rateLimits }: LimitsPanelProps) {
  const hasLimits = rateLimits?.dataAvailable === true
  const hasWeeklyTarget = usage?.dataAvailable === true && usage.weeklyTokenTarget > 0
  if (!hasLimits && !hasWeeklyTarget) return null

  return (
    <section
      aria-labelledby="limits-heading"
      className="flex flex-col gap-2 border-t border-border pt-2.5"
    >
      <div className="flex items-baseline justify-between">
        <h2 id="limits-heading" className={PLATE_TITLE_CLASS}>
          Limits
        </h2>
        {hasLimits && rateLimits.isStale && rateLimits.updated_at && (
          <span className="text-caption text-text-tertiary">
            updated {timeAgo(new Date(rateLimits.updated_at))}
          </span>
        )}
      </div>
      {hasLimits && rateLimits.isVeryStale && <StaleLimitsNotice />}
      <LimitLines usage={usage} rateLimits={rateLimits} />
    </section>
  )
}

type SyncSetup = 'idle' | 'loading' | 'done'

// Limits this old mean the statusline feed is not running; offer to install it when it is absent.
function StaleLimitsNotice() {
  const [syncSetup, setSyncSetup] = useState<SyncSetup>('idle')
  const [hasStatusline, setHasStatusline] = useState<boolean | null>(null)

  useEffect(() => {
    window.api
      ?.isStatuslineConfigured?.()
      .then(setHasStatusline)
      .catch(() => setHasStatusline(null))
  }, [])

  const handleSetup = async (): Promise<void> => {
    setSyncSetup('loading')
    const isConfigured = await window.api.setupRateLimitSync?.()
    setSyncSetup(isConfigured ? 'done' : 'idle')
  }

  if (hasStatusline !== false) {
    return (
      <p className="text-xs text-text-secondary" role="status">
        Limits are out of date. They refresh the next time Claude Code runs.
      </p>
    )
  }
  if (syncSetup === 'done') {
    return (
      <p className="text-xs text-status-active" role="status">
        Sync configured. Limits update the next time Claude Code runs.
      </p>
    )
  }
  return (
    <p className="text-xs text-text-secondary" role="status">
      Limits are out of date.{' '}
      <button
        type="button"
        onClick={() => void handleSetup()}
        disabled={syncSetup === 'loading'}
        className="font-semibold text-accent underline disabled:opacity-50"
      >
        {syncSetup === 'loading' ? 'Setting up…' : 'Set up sync'}
      </button>
    </p>
  )
}
