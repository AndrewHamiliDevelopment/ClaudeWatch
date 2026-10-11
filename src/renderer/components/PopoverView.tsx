import { useEffect, useState } from 'react'
import { Building2, Lamp, Pin, PinOff, Power, X } from 'lucide-react'
import { usePromoStatus } from '../hooks/usePromoStatus'
import { useRateLimits } from '../hooks/useRateLimits'
import { useSquads } from '../hooks/useSquads'
import { useUsage } from '../hooks/useUsage'
import { openOffice } from '../deck/deck-api'
import { tallySquads, type Squad, type SquadTally } from '../deck/roster'
import { needsYouLabel } from '../office/logic/floor-model'
import type { UsageStats } from '../lib/types'
import { cn, formatCompactNumber, formatCurrency } from '../lib/utils'
import {
  BUTTON_PRIMARY_CLASS,
  BUTTON_QUIET_CLASS,
  ICON_BUTTON_CLASS,
  ICON_BUTTON_REGULAR_CLASS
} from './deck/deck-styles'
import { Crest } from './deck/Plate'
import { LimitLines } from './deck/LimitLines'
import { StateIcon } from './deck/StateMark'
import { WorkOrderSlip } from './deck/WorkOrderSlip'

export function PopoverView() {
  const { squads, workOrders } = useSquads()
  const { usage } = useUsage()
  const { promo } = usePromoStatus()
  const { rateLimits } = useRateLimits()
  const [isPinned, setIsPinned] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return
    void window.api.getPopoverPinned?.().then((pinned) => setIsPinned(pinned === true))
    return window.api.onPopoverPinChanged?.(setIsPinned)
  }, [])

  const tally = tallySquads(squads)

  return (
    <div
      className={cn(
        'flex h-screen flex-col overflow-hidden bg-surface text-body',
        isPinned && 'drag-region rounded-lg ring-1 ring-inset ring-brass'
      )}
    >
      <header className="flex h-[42px] shrink-0 items-center gap-1 border-b border-brass-line bg-surface-rail pl-3 pr-2">
        <h1 className="mr-auto flex items-center gap-1.5 pt-[3px] font-plate text-title">
          <Lamp className="-mt-[3px] size-4 text-gold" aria-hidden="true" />
          ClaudeWatch
          {promo?.is2x && (
            <span className="rounded bg-surface-hover px-1.5 font-sans text-caption font-semibold text-status-active">
              2x limits
            </span>
          )}
        </h1>
        <button
          type="button"
          onClick={() => void window.api?.setPopoverPinned(!isPinned)}
          aria-label={isPinned ? 'Unpin window' : 'Pin window'}
          aria-pressed={isPinned}
          title={isPinned ? 'Unpin window' : 'Pin window (always on top)'}
          className={cn(ICON_BUTTON_CLASS, 'no-drag aria-pressed:text-accent')}
        >
          {isPinned ? (
            <Pin className="size-3.5" aria-hidden="true" />
          ) : (
            <PinOff className="size-3.5" aria-hidden="true" />
          )}
        </button>
        <button
          type="button"
          onClick={() => void window.api?.closePopover()}
          aria-label="Close popover"
          className={cn(ICON_BUTTON_CLASS, 'no-drag')}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </header>

      <Tally tally={tally} isFeedLive={workOrders !== null} usage={usage} />

      <div className="no-drag flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pb-2">
        {workOrders !== null && workOrders.length > 0 && (
          <ol className="flex flex-col gap-1.5 px-2.5" aria-label="Needs you">
            {workOrders.map((order) => (
              <WorkOrderSlip key={order.sessionKey} order={order} isCompact />
            ))}
          </ol>
        )}
        {squads.length === 0 ? (
          <p className="px-3 py-8 text-center text-text-secondary" role="status">
            No agents running
          </p>
        ) : (
          <ul className="px-3" aria-label="Squads">
            {squads.map((squad) => (
              <SquadLine key={squad.key} squad={squad} />
            ))}
          </ul>
        )}
      </div>

      <footer className="no-drag flex shrink-0 flex-col gap-2 border-t border-border bg-surface-rail px-3 pb-3 pt-2">
        <LimitLines usage={usage} rateLimits={rateLimits} />
        <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
          <button type="button" onClick={openOffice} className={BUTTON_PRIMARY_CLASS}>
            <Building2 className="size-4" aria-hidden="true" />
            Open Office
          </button>
          <button
            type="button"
            onClick={() => void window.api?.openDashboard()}
            className={BUTTON_QUIET_CLASS}
          >
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => void window.api?.quit()}
            aria-label="Quit ClaudeWatch"
            title="Quit ClaudeWatch"
            className={ICON_BUTTON_REGULAR_CLASS}
          >
            <Power className="size-4" aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  )
}

interface TallyProps {
  tally: SquadTally
  // Without the office feed nobody can say who waits, so that count is left out.
  isFeedLive: boolean
  usage: UsageStats | null
}

// Doubles as the legend for the pips in the squad rows.
function Tally({ tally, isFeedLive, usage }: TallyProps) {
  return (
    <div className="flex h-9 shrink-0 items-center gap-3 px-3 text-xs text-text-secondary">
      <p role="status" aria-label="Agents" className="flex items-center gap-3">
        {isFeedLive && (
          <span
            className={cn(
              'inline-flex items-center gap-1.5',
              tally.needsYou > 0 && 'font-semibold text-text-primary'
            )}
          >
            <StateIcon state="needs-you" />
            {needsYouLabel(tally.needsYou)}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <StateIcon state="working" />
          {tally.working} working
        </span>
        <span className="inline-flex items-center gap-1.5">
          <StateIcon state="idle" />
          {tally.resting} at rest
        </span>
      </p>
      {usage?.dataAvailable && (
        <span className="ml-auto tabular-nums" title="Cost of the latest sessions">
          {formatCurrency(usage.totalCostUSD)}
        </span>
      )}
    </div>
  )
}

function describePips(tally: SquadTally): string {
  return [
    tally.needsYou > 0 && needsYouLabel(tally.needsYou),
    tally.working > 0 && `${tally.working} working`,
    tally.resting > 0 && `${tally.resting} at rest`
  ]
    .filter(Boolean)
    .join(', ')
}

function SquadLine({ squad }: { squad: Squad }) {
  const tally = tallySquads([squad])
  return (
    <li className="grid h-[30px] grid-cols-[22px_minmax(0,1fr)_auto_auto] items-center gap-2 border-b border-border/40">
      <Crest letters={squad.crest} />
      <span className="truncate font-semibold">{squad.name}</span>
      <span className="inline-flex items-center gap-1">
        <span className="sr-only">{describePips(tally)}</span>
        {squad.agents.map((agent) => (
          <StateIcon
            key={agent.pid}
            state={agent.state === 'needs-you' || agent.state === 'working' ? agent.state : 'idle'}
          />
        ))}
      </span>
      {squad.tokens !== null && (
        <span className="min-w-10 text-right tabular-nums text-accent">
          {formatCompactNumber(squad.tokens)}
          <span className="sr-only"> tokens</span>
        </span>
      )}
    </li>
  )
}
