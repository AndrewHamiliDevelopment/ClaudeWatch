import { History } from 'lucide-react'
import type { AccountLimit } from '../../../shared/accounts'
import { NEAR_LIMIT_PERCENT } from '../../deck/limits'
import { cn } from '../../lib/utils'
import { NearLimitMark } from '../deck/LimitLines'
import { SegmentedMeter } from '../deck/SegmentedMeter'
import { limitWindowName, readAccountLimit, type AccountLimitReading } from './account-view'

// A reading that is no longer the present says so in words, and its meter is dimmed.
const AGE_NOTE: Record<AccountLimitReading['age'], string | null> = {
  current: null,
  old: 'Old reading',
  reset: 'Window has reset since'
}

interface AccountLimitsProps {
  accountName: string
  limits: readonly AccountLimit[]
  nowMs: number
}

export function AccountLimits({ accountName, limits, nowMs }: AccountLimitsProps) {
  if (limits.length === 0) {
    return (
      <p className="text-xs text-text-secondary">
        Limits unknown. Orca has no reading for this account.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {limits.map((limit) => (
        <LimitLine
          key={`${limit.windowMinutes}:${limit.scope ?? ''}`}
          accountName={accountName}
          limit={limit}
          nowMs={nowMs}
        />
      ))}
    </ul>
  )
}

interface LimitLineProps {
  accountName: string
  limit: AccountLimit
  nowMs: number
}

function LimitLine({ accountName, limit, nowMs }: LimitLineProps) {
  const { percent, age, ageText } = readAccountLimit(limit, nowMs)
  const windowName = limitWindowName(limit)
  const percentText = `${Math.round(percent)}%`
  const ageNote = AGE_NOTE[age]
  const isCurrent = ageNote === null
  const isNearLimit = isCurrent && percent >= NEAR_LIMIT_PERCENT

  return (
    <li className="flex flex-col gap-1 text-xs">
      <div className="flex flex-wrap items-center gap-x-2">
        <span className="mr-auto font-semibold text-text-primary">{windowName}</span>
        <span
          className={cn(
            'inline-flex items-center gap-1 tabular-nums',
            isCurrent ? 'font-semibold text-text-primary' : 'text-text-tertiary',
            isNearLimit && 'text-accent-hot'
          )}
        >
          {isNearLimit && <NearLimitMark />}
          {percentText}
        </span>
        <span className="inline-flex items-center gap-1 text-text-secondary">
          {!isCurrent && <History className="size-3.5 shrink-0" aria-hidden="true" />}
          {isCurrent ? ageText : `${ageNote}, ${ageText}`}
        </span>
      </div>
      <SegmentedMeter
        label={`${accountName} ${windowName} limit`}
        percent={percent}
        valueText={
          isCurrent
            ? `${percentText}, ${ageText}`
            : `${percentText}, ${ageNote.toLowerCase()}, ${ageText}`
        }
        markPercent={NEAR_LIMIT_PERCENT}
        className={cn(!isCurrent && 'opacity-50')}
      />
    </li>
  )
}
