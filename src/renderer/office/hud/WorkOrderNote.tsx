import { useId } from 'react'
import { BUTTON_INK_CLASS } from '../../components/deck/deck-styles'
import { Seal, SLIP_CLASS, WaitClock } from '../../components/deck/WorkOrderSlip'
import { WORK_ORDER_ACTION } from '../../deck/work-orders'
import { cn } from '../../lib/utils'
import type { AttentionItem } from '../logic/attention-queue'
import { GEM_SPECS } from '../logic/status-gem'

interface WorkOrderNoteProps {
  attention: AttentionItem['attention']
  sessionName: string
  sinceMs: number
  onAction: () => void
}

// The queue's slip again, inside the inspector: the same reason, wait and action.
export function WorkOrderNote({ attention, sessionName, sinceMs, onAction }: WorkOrderNoteProps) {
  const headingId = useId()
  const action = WORK_ORDER_ACTION[attention]
  return (
    <section aria-labelledby={headingId} className={cn(SLIP_CLASS, 'flex items-center gap-2 p-2')}>
      <Seal attention={attention} />
      <div className="min-w-0 flex-1">
        <h3 id={headingId} className="truncate text-body font-bold">
          {GEM_SPECS[attention].label}
        </h3>
        <p className="text-xs text-ink-soft">
          <WaitClock sinceMs={sinceMs} />
        </p>
      </div>
      <button
        type="button"
        aria-label={`${action} ${sessionName}`}
        onClick={onAction}
        className={BUTTON_INK_CLASS}
      >
        {action}
      </button>
    </section>
  )
}
