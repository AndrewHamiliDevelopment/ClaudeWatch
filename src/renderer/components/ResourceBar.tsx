import type { ReactNode } from 'react'
import { Bot, Coins, Diamond, Flag, Gauge, type LucideIcon } from 'lucide-react'
import { NEAR_LIMIT_PERCENT, readLimit } from '../deck/limits'
import { needsYouLabel } from '../office/logic/floor-model'
import type { RateLimits, UsageStats } from '../lib/types'
import { cn, formatCompactNumber, formatCurrency } from '../lib/utils'
import { NearLimitMark } from './deck/LimitLines'
import { SegmentedMeter } from './deck/SegmentedMeter'

interface ResourceBarProps {
  squadCount: number
  agentCount: number
  // Null while the office feed is unavailable and nobody can say who waits.
  needsYouCount: number | null
  usage: UsageStats | null
  rateLimits: RateLimits | null
}

export function ResourceBar({
  squadCount,
  agentCount,
  needsYouCount,
  usage,
  rateLimits
}: ResourceBarProps) {
  const hasUsage = usage?.dataAvailable === true
  const hasLimits = rateLimits?.dataAvailable === true && !rateLimits.isVeryStale

  return (
    <section
      aria-label="Resources"
      className="flex h-11 shrink-0 items-center border-b border-brass-line bg-surface-rail px-4"
    >
      <Resource icon={Flag} value={String(squadCount)} label="squads" />
      <Resource icon={Bot} value={String(agentCount)} label="agents" />
      {needsYouCount !== null && needsYouCount > 0 && (
        <ResourceSlot>
          <span className="inline-flex h-6 items-center gap-1.5 rounded bg-paper pl-1.5 pr-2 text-xs font-semibold text-ink">
            <Diamond className="size-3 fill-seal stroke-ink" aria-hidden="true" />
            {needsYouLabel(needsYouCount)}
          </span>
        </ResourceSlot>
      )}
      {hasUsage && (
        <>
          <Resource
            icon={Gauge}
            value={formatCompactNumber(usage.weeklyTokens)}
            label="tokens this week"
            isTokens
          />
          <Resource icon={Coins} value={formatCurrency(usage.totalCostUSD)} label="cost" />
        </>
      )}
      {hasLimits && <FiveHourWindow rateLimits={rateLimits} />}
    </section>
  )
}

function ResourceSlot({ children }: { children: ReactNode }) {
  return (
    <div className="mr-2.5 flex items-center gap-1.5 whitespace-nowrap border-r border-border/60 pr-2.5">
      {children}
    </div>
  )
}

interface ResourceProps {
  icon: LucideIcon
  value: string
  label: string
  isTokens?: boolean
}

function Resource({ icon: Icon, value, label, isTokens = false }: ResourceProps) {
  return (
    <ResourceSlot>
      <Icon
        className={cn('size-4', isTokens ? 'text-accent' : 'text-text-tertiary')}
        aria-hidden="true"
      />
      <span className={cn('pt-1 font-plate text-count', isTokens && 'text-accent')}>{value}</span>
      <span className="text-xs text-text-secondary">{label}</span>
    </ResourceSlot>
  )
}

function FiveHourWindow({ rateLimits }: { rateLimits: RateLimits }) {
  const limit = readLimit(rateLimits.window_5h)
  return (
    <div
      className={cn(
        'ml-auto flex items-center gap-2 whitespace-nowrap text-xs text-text-secondary',
        rateLimits.isStale && 'opacity-60'
      )}
    >
      <span className="font-semibold text-text-primary">5-hour</span>
      <SegmentedMeter
        label="5-hour limit"
        percent={limit.percent}
        valueText={limit.text}
        markPercent={NEAR_LIMIT_PERCENT}
        className="w-14"
      />
      <span
        className={cn(
          'inline-flex items-center gap-1 tabular-nums',
          limit.isNearLimit && 'font-semibold text-accent-hot'
        )}
      >
        {limit.isNearLimit && <NearLimitMark />}
        {limit.text}
      </span>
    </div>
  )
}
