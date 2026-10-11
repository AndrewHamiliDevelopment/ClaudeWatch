import { SquareTerminal } from 'lucide-react'
import {
  BUTTON_INK_CLASS,
  BUTTON_INK_QUIET_CLASS,
  BUTTON_QUIET_COMPACT_CLASS,
  PLATE_TITLE_CLASS
} from '../../components/deck/deck-styles'
import { Plate } from '../../components/deck/Plate'
import { Seal, SLIP_CLASS, WaitClock } from '../../components/deck/WorkOrderSlip'
import { WORK_ORDER_ACTION } from '../../deck/work-orders'
import { cn } from '../../lib/utils'
import type { AttentionItem } from '../logic/attention-queue'
import { GEM_SPECS } from '../logic/status-gem'
import { KBD_CLASS } from './hud-styles'

interface QueueActions {
  onOpen: (sessionKey: string) => void
  onReview: (sessionKey: string) => void
  onFocusTerminal: (sessionKey: string) => void
}

interface AttentionRailProps extends QueueActions {
  queue: readonly AttentionItem[]
  activeSessionKey: string | null
  onNext: () => void
  // Sessions whose permission prompt can be answered from the office.
  reviewableKeys: ReadonlySet<string>
}

interface QueueSlipProps extends QueueActions {
  item: AttentionItem
  isActive: boolean
  isReviewable: boolean
}

// The same name, reason and action as the dashboard's work order. Where the office cannot
// answer the prompt itself, the action goes to the agent's terminal, as it does there.
function QueueSlip({ item, isActive, isReviewable, ...actions }: QueueSlipProps) {
  const action = WORK_ORDER_ACTION[item.attention]
  return (
    <li
      className={cn(
        SLIP_CLASS,
        'flex flex-col gap-1.5 p-2 motion-safe:animate-slip-drop',
        isActive && 'ring-2 ring-accent'
      )}
    >
      <button
        type="button"
        onClick={() => actions.onOpen(item.sessionKey)}
        aria-current={isActive ? 'true' : undefined}
        className="flex min-w-0 items-center gap-2 rounded text-left"
      >
        <Seal attention={item.attention} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-body font-bold">{item.sessionName}</span>
          <span className="block truncate text-xs text-ink-soft">
            {GEM_SPECS[item.attention].label}, {item.projectLabel}, {item.companyLabel}
          </span>
        </span>
        <span className="shrink-0 text-caption text-ink-soft">
          <WaitClock sinceMs={item.sinceMs} isTerse />
        </span>
      </button>
      <div className="flex justify-end gap-1.5">
        {isReviewable && (
          <button
            type="button"
            aria-label={`Focus terminal for ${item.sessionName}`}
            onClick={() => actions.onFocusTerminal(item.sessionKey)}
            className={BUTTON_INK_QUIET_CLASS}
          >
            <SquareTerminal aria-hidden="true" className="size-3.5" />
            Terminal
          </button>
        )}
        <button
          type="button"
          aria-label={`${action} ${item.sessionName}`}
          onClick={() =>
            isReviewable
              ? actions.onReview(item.sessionKey)
              : actions.onFocusTerminal(item.sessionKey)
          }
          className={BUTTON_INK_CLASS}
        >
          {action}
        </button>
      </div>
    </li>
  )
}

// Longest wait first: the queue arrives sorted by when each session started waiting.
export function AttentionRail({
  queue,
  activeSessionKey,
  onNext,
  reviewableKeys,
  ...actions
}: AttentionRailProps) {
  return (
    <section aria-labelledby="office-queue-heading">
      <Plate faceClassName="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="office-queue-heading" className={PLATE_TITLE_CLASS}>
            Needs you
          </h2>
          <button
            type="button"
            onClick={onNext}
            disabled={queue.length === 0}
            className={BUTTON_QUIET_COMPACT_CLASS}
          >
            Next <kbd className={KBD_CLASS}>N</kbd>
          </button>
        </div>
        {queue.length === 0 ? (
          <p className="text-body text-text-secondary">Nothing is waiting on you.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {queue.map((item) => (
              <QueueSlip
                key={item.sessionKey}
                item={item}
                isActive={item.sessionKey === activeSessionKey}
                isReviewable={reviewableKeys.has(item.sessionKey)}
                {...actions}
              />
            ))}
          </ol>
        )}
      </Plate>
    </section>
  )
}
