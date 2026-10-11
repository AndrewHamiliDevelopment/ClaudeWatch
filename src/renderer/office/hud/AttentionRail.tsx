import { cn, formatElapsedTime } from '../../lib/utils'
import type { AttentionItem } from '../logic/attention-queue'
import { GEM_SPECS } from '../logic/status-gem'
import { FOCUS_RING_CLASS, HUD_BUTTON_CLASS, KBD_CLASS, PANEL_CLASS } from './hud-styles'
import { StateIcon } from './StateChip'

interface AttentionRailProps {
  queue: readonly AttentionItem[]
  activeSessionKey: string | null
  nowMs: number
  onOpen: (sessionKey: string) => void
  onNext: () => void
  // Sessions whose permission prompt can be answered from the office.
  reviewableKeys: ReadonlySet<string>
  onReview: (sessionKey: string) => void
}

export function AttentionRail({
  queue,
  activeSessionKey,
  nowMs,
  onOpen,
  onNext,
  reviewableKeys,
  onReview
}: AttentionRailProps) {
  return (
    <section
      aria-labelledby="office-queue-heading"
      className={cn(PANEL_CLASS, 'flex flex-col gap-2 p-3')}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="office-queue-heading" className="text-heading text-text-primary">
          Needs you
        </h2>
        <button
          type="button"
          onClick={onNext}
          disabled={queue.length === 0}
          className={cn(
            HUD_BUTTON_CLASS,
            FOCUS_RING_CLASS,
            'flex items-center gap-1.5 bg-surface-hover'
          )}
        >
          Next <kbd className={KBD_CLASS}>N</kbd>
        </button>
      </div>
      {queue.length === 0 ? (
        <p className="text-body text-text-secondary">Nothing is waiting on you.</p>
      ) : (
        <ol className="flex flex-col gap-1">
          {queue.map((item) => {
            const spec = GEM_SPECS[item.attention]
            const isActive = item.sessionKey === activeSessionKey
            const waitedFor = formatElapsedTime(
              Math.max(0, Math.floor((nowMs - item.sinceMs) / 1000))
            )
            return (
              <li key={item.sessionKey} className="flex items-start gap-1">
                <button
                  type="button"
                  onClick={() => onOpen(item.sessionKey)}
                  aria-current={isActive ? 'true' : undefined}
                  className={cn(
                    FOCUS_RING_CLASS,
                    'flex min-w-0 flex-1 flex-col gap-0.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-hover',
                    isActive && 'bg-accent-muted'
                  )}
                >
                  <span className="flex items-center gap-1.5 text-body text-text-primary">
                    <StateIcon spec={spec} />
                    <span className="min-w-0 truncate">{item.sessionName}</span>
                  </span>
                  <span className="text-caption text-text-secondary">
                    {spec.label}, {item.projectLabel}, waiting {waitedFor}
                  </span>
                </button>
                {reviewableKeys.has(item.sessionKey) && (
                  <button
                    type="button"
                    aria-label={`Review ${item.sessionName}`}
                    onClick={() => onReview(item.sessionKey)}
                    className={cn(
                      HUD_BUTTON_CLASS,
                      FOCUS_RING_CLASS,
                      'mt-1 shrink-0 bg-surface-hover text-caption'
                    )}
                  >
                    Review
                  </button>
                )}
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}
