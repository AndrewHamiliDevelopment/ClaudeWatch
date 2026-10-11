import { Building2 } from 'lucide-react'
import { openOffice } from '../deck/deck-api'
import { tallySquads, type Squad } from '../deck/roster'
import type { RateLimits, UsageStats } from '../lib/types'
import { formatCompactNumber } from '../lib/utils'
import { BUTTON_PRIMARY_CLASS, PLATE_TITLE_CLASS } from './deck/deck-styles'
import { FloorMap } from './deck/FloorMap'
import { Plate } from './deck/Plate'
import { SegmentedMeter } from './deck/SegmentedMeter'
import { LimitsPanel } from './LimitsPanel'

export interface LedgerRow {
  key: string
  name: string
  tokens: number
}

interface GaugeWallProps {
  squads: readonly Squad[]
  usage: UsageStats | null
  rateLimits: RateLimits | null
  // Today's tokens per account; empty unless there are accounts to compare.
  accountTokens?: readonly LedgerRow[]
}

const SECTION_DIVIDER_CLASS = 'border-t border-border pt-2.5'

// One continuous plate of instruments beside the roster.
export function GaugeWall({ squads, usage, rateLimits, accountTokens = [] }: GaugeWallProps) {
  const projectTokens = squads.flatMap((squad) =>
    squad.tokens === null ? [] : [{ key: squad.key, name: squad.name, tokens: squad.tokens }]
  )

  return (
    <Plate faceClassName="flex flex-col gap-2.5 px-3.5 pb-4 pt-3">
      <OfficeEntry squads={squads} />
      <TokenLedger title="Tokens by project" note="live sessions" rows={projectTokens} />
      <TokenLedger title="Tokens by account" note="today" rows={accountTokens} />
      <LimitsPanel usage={usage} rateLimits={rateLimits} />
    </Plate>
  )
}

function OfficeEntry({ squads }: { squads: readonly Squad[] }) {
  const tally = tallySquads(squads)
  const agentCount = tally.needsYou + tally.working + tally.resting
  const floorNote =
    tally.needsYou > 0
      ? `${agentCount} on the floor, ${tally.needsYou} holding a work order`
      : `${agentCount} on the floor`

  return (
    <section aria-labelledby="office-heading" className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h2 id="office-heading" className={PLATE_TITLE_CLASS}>
          Office
        </h2>
        <span className="truncate text-caption text-text-tertiary">{floorNote}</span>
      </div>
      <FloorMap squads={squads} />
      <button type="button" onClick={openOffice} className={BUTTON_PRIMARY_CLASS}>
        <Building2 className="size-4" aria-hidden="true" />
        Open Office
      </button>
    </section>
  )
}

interface TokenLedgerProps {
  title: string
  note: string
  rows: readonly LedgerRow[]
}

function TokenLedger({ title, note, rows }: TokenLedgerProps) {
  if (rows.length === 0) return null
  const totalTokens = rows.reduce((sum, row) => sum + row.tokens, 0)
  const rankedRows = [...rows].sort((a, b) => b.tokens - a.tokens)

  return (
    <section aria-label={title} className={SECTION_DIVIDER_CLASS}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <h2 className={PLATE_TITLE_CLASS}>{title}</h2>
        <span className="text-caption text-text-tertiary">
          {note}, {formatCompactNumber(totalTokens)}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {rankedRows.map((row) => {
          const sharePercent = totalTokens > 0 ? Math.round((row.tokens / totalTokens) * 100) : 0
          const tokensText = formatCompactNumber(row.tokens)
          return (
            <li key={row.key} className="text-body">
              <div className="mb-1 flex items-baseline gap-2">
                <span className="mr-auto truncate">{row.name}</span>
                <span className="font-semibold tabular-nums">{tokensText}</span>
                <span className="w-8 text-right text-caption tabular-nums text-text-tertiary">
                  {sharePercent}%
                </span>
              </div>
              <SegmentedMeter
                label={`${row.name} share of tokens`}
                percent={sharePercent}
                valueText={`${tokensText}, ${sharePercent}%`}
              />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
