import { useState } from 'react'
import { Search } from 'lucide-react'
import { useAccounts } from '../hooks/useAccounts'
import { usePromoStatus } from '../hooks/usePromoStatus'
import { useRateLimits } from '../hooks/useRateLimits'
import { useSquads } from '../hooks/useSquads'
import { useUsage } from '../hooks/useUsage'
import { filterSquads } from '../deck/roster'
import type { PromoStatus } from '../lib/types'
import { formatCountdown } from '../lib/utils'
import { accountTokenRows } from './accounts/account-view'
import { PLATE_TITLE_CLASS } from './deck/deck-styles'
import { GaugeWall } from './GaugeWall'
import { NeedsYouLane } from './NeedsYouLane'
import { ResourceBar } from './ResourceBar'
import { SquadRoster } from './SquadRoster'

export function Dashboard() {
  const { agentCount, squads, workOrders } = useSquads()
  const { usage } = useUsage()
  const { promo } = usePromoStatus()
  const { rateLimits } = useRateLimits()
  const { accounts } = useAccounts()
  const [searchQuery, setSearchQuery] = useState('')

  const visibleSquads = filterSquads(squads, searchQuery)
  const hasNoMatch = squads.length > 0 && visibleSquads.length === 0
  const accountTokens = accounts.status === 'on' ? accountTokenRows(accounts) : []

  return (
    <div className="no-drag flex h-full min-h-0 flex-col overflow-hidden">
      <h1 className="sr-only">Dashboard</h1>
      <ResourceBar
        squadCount={squads.length}
        agentCount={agentCount}
        needsYouCount={workOrders ? workOrders.length : null}
        usage={usage}
        rateLimits={rateLimits}
      />
      {promo?.promoActive && <PromoLine promo={promo} />}

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_288px] gap-4 px-4 pb-4 pt-3.5">
        <div className="flex min-h-0 flex-col gap-3">
          {/* Outside the scroll region so the slips stay in view while the roster scrolls. */}
          <div className="max-h-[45%] shrink-0 overflow-y-auto empty:hidden">
            <NeedsYouLane orders={workOrders} />
          </div>
          <div className="flex h-7 shrink-0 items-center gap-2">
            <h2 className={`${PLATE_TITLE_CLASS} mr-auto`}>Squads</h2>
            <label className="flex h-7 w-52 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-2 text-text-tertiary focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent">
              <Search className="size-3.5 shrink-0" aria-hidden="true" />
              <input
                type="search"
                name="agent-search"
                autoComplete="off"
                placeholder="Find an agent…"
                aria-label="Find an agent"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="min-w-0 flex-1 bg-transparent text-xs text-text-primary caret-accent outline-none placeholder:text-text-tertiary"
              />
            </label>
          </div>
          <div
            className="no-drag min-h-0 flex-1 overflow-y-auto pr-1"
            data-testid="dashboard-scroll-region"
          >
            {hasNoMatch ? (
              <p className="py-10 text-center text-body text-text-secondary" role="status">
                No agent matches “{searchQuery.trim()}”.
              </p>
            ) : (
              <SquadRoster squads={visibleSquads} />
            )}
          </div>
        </div>

        <aside className="min-h-0 overflow-y-auto" aria-label="Instruments">
          <GaugeWall
            squads={squads}
            usage={usage}
            rateLimits={rateLimits}
            accountTokens={accountTokens}
          />
        </aside>
      </div>
    </div>
  )
}

function PromoLine({ promo }: { promo: PromoStatus }) {
  return (
    <p
      className="shrink-0 border-b border-border bg-surface-rail px-4 py-1.5 text-xs text-text-secondary"
      role="status"
    >
      {promo.is2x ? (
        <>
          <strong className="font-semibold text-status-active">2x limits active</strong>
          {promo.expiresInSeconds != null && `, ends in ${formatCountdown(promo.expiresInSeconds)}`}
          .
        </>
      ) : (
        <>
          <strong className="font-semibold text-text-primary">Standard limits</strong>
          {promo.nextWindowStart && `, 2x resumes at ${promo.nextWindowStart}`}.
        </>
      )}{' '}
      {promo.promoPeriod} promo.
    </p>
  )
}
