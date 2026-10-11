import { TriangleAlert } from 'lucide-react'
import { NEAR_LIMIT_PERCENT, readLimit } from '../../deck/limits'
import type { RateLimits, UsageStats } from '../../lib/types'
import { cn, formatCompactNumber } from '../../lib/utils'
import { SegmentedMeter } from './SegmentedMeter'

export function NearLimitMark() {
  return (
    <>
      <TriangleAlert className="size-3.5 shrink-0" aria-hidden="true" />
      <span className="sr-only">Near limit</span>
    </>
  )
}

interface LimitLineProps {
  name: string
  meterLabel: string
  percent: number
  valueText: string
}

function LimitLine({ name, meterLabel, percent, valueText }: LimitLineProps) {
  const isNearLimit = percent >= NEAR_LIMIT_PERCENT
  return (
    <div className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 whitespace-nowrap text-xs text-text-secondary">
      <span className="font-semibold text-text-primary">{name}</span>
      <SegmentedMeter
        label={meterLabel}
        percent={percent}
        valueText={valueText}
        markPercent={NEAR_LIMIT_PERCENT}
      />
      <span
        className={cn(
          'inline-flex items-center gap-1 tabular-nums',
          isNearLimit && 'font-semibold text-accent-hot'
        )}
      >
        {isNearLimit && <NearLimitMark />}
        {valueText}
      </span>
    </div>
  )
}

interface LimitLinesProps {
  usage: UsageStats | null
  rateLimits: RateLimits | null
}

// The 5-hour and 7-day windows and the weekly token target, one line each. Shared by the
// dashboard's gauge wall and the popover footer.
export function LimitLines({ usage, rateLimits }: LimitLinesProps) {
  const hasLimits = rateLimits?.dataAvailable === true && !rateLimits.isVeryStale
  const hasWeeklyTarget = usage?.dataAvailable === true && usage.weeklyTokenTarget > 0
  if (!hasLimits && !hasWeeklyTarget) return null

  const fiveHour = hasLimits ? readLimit(rateLimits.window_5h) : null
  const sevenDay = hasLimits ? readLimit(rateLimits.window_7d) : null

  return (
    <div className="flex flex-col gap-1.5">
      {fiveHour && sevenDay && (
        <div className={cn('flex flex-col gap-1.5', rateLimits?.isStale && 'opacity-60')}>
          <LimitLine
            name="5-hour"
            meterLabel="5-hour limit"
            percent={fiveHour.percent}
            valueText={fiveHour.text}
          />
          <LimitLine
            name="7-day"
            meterLabel="7-day limit"
            percent={sevenDay.percent}
            valueText={sevenDay.text}
          />
        </div>
      )}
      {hasWeeklyTarget && (
        <LimitLine
          name="Week"
          meterLabel="Weekly token target"
          percent={(usage.weeklyTokens / usage.weeklyTokenTarget) * 100}
          valueText={`${formatCompactNumber(usage.weeklyTokens)} of ${formatCompactNumber(usage.weeklyTokenTarget)}`}
        />
      )}
    </div>
  )
}
