import { CircleHelp, Hand, type LucideIcon } from 'lucide-react'
import { useNow } from '../../hooks/useNow'
import { jumpToAgent } from '../../deck/deck-api'
import { cn, formatElapsedTime } from '../../lib/utils'
import { WORK_ORDER_ACTION, type WorkOrder } from '../../deck/work-orders'
import { GEM_SPECS } from '../../office/logic/status-gem'
import { BUTTON_INK_CLASS } from './deck-styles'

const SEAL_ICON: Record<WorkOrder['attention'], LucideIcon> = {
  permission: Hand,
  question: CircleHelp
}

// The paper itself, shared with the Office HUD's work orders.
export const SLIP_CLASS = 'on-paper rounded bg-paper text-ink shadow-slip'

interface SealProps {
  attention: WorkOrder['attention']
  // The stamp on a floating name tag, where the full seal would be larger than the name.
  isSmall?: boolean
}

export function Seal({ attention, isSmall = false }: SealProps) {
  const SealIcon = SEAL_ICON[attention]
  return (
    <span
      className={cn(
        'inline-grid shrink-0 -rotate-[4deg] place-items-center bg-seal text-paper',
        isSmall ? 'size-3.5 rounded-[3px]' : 'size-[30px] rounded-[5px]'
      )}
      aria-hidden="true"
    >
      <SealIcon className={isSmall ? 'size-2.5' : 'size-4'} strokeWidth={2.1} />
    </span>
  )
}

const CLOCK_INTERVAL_MS = 1000

export function WaitClock({ sinceMs, isTerse = false }: { sinceMs: number; isTerse?: boolean }) {
  const nowMs = useNow(CLOCK_INTERVAL_MS)
  const waitedSeconds = Math.max(0, Math.floor((nowMs - sinceMs) / 1000))
  return (
    <span className="tabular-nums">
      <span className={isTerse ? 'sr-only' : undefined}>waiting </span>
      {formatElapsedTime(waitedSeconds)}
    </span>
  )
}

interface WorkOrderSlipProps {
  order: WorkOrder
  // The popover has no room for a meta column, so the project and the wait share one line.
  isCompact?: boolean
}

// Paper is reserved for "needs you": the seal icon and the words carry it without colour.
export function WorkOrderSlip({ order, isCompact = false }: WorkOrderSlipProps) {
  const reason = GEM_SPECS[order.attention].label
  const action = WORK_ORDER_ACTION[order.attention]

  return (
    <li
      className={cn(
        SLIP_CLASS,
        'flex items-center gap-2.5 px-2.5 py-2 motion-safe:animate-slip-drop'
      )}
    >
      <Seal attention={order.attention} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-body font-bold">{order.sessionName}</h3>
        <p className="truncate text-xs text-ink-soft">
          <span>{reason}</span>
          {isCompact && (
            <>
              , <WaitClock sinceMs={order.sinceMs} isTerse />
            </>
          )}
        </p>
      </div>
      {!isCompact && (
        <p className="shrink-0 text-right text-caption text-ink-soft">
          <strong className="block text-xs font-semibold text-ink">{order.projectLabel}</strong>
          <WaitClock sinceMs={order.sinceMs} />
        </p>
      )}
      <button
        type="button"
        onClick={() => void jumpToAgent(order.target)}
        aria-label={`${action} ${order.sessionName}`}
        className={cn(BUTTON_INK_CLASS, 'shrink-0')}
      >
        {action}
      </button>
    </li>
  )
}
