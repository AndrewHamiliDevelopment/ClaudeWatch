import { Diamond } from 'lucide-react'
import type { ReactNode } from 'react'
import { ICON_BUTTON_CLASS } from '../../components/deck/deck-styles'
import { agentCountLabel, needsYouLabel } from '../logic/floor-model'
import type { OfficeProjectRow } from '../logic/zone-model'
import type { OfficeTheme } from '../themes/types'
import { ROW_CLASS } from './hud-styles'
import { formatTotal } from '../../deck/tokens'

type RowCounts = Pick<OfficeProjectRow, 'label' | 'zoneId' | 'agentCount' | 'attentionCount'>

function rowName(row: RowCounts, tokens: number | undefined, isPartial: boolean): string {
  const waiting = row.attentionCount > 0 ? `, ${needsYouLabel(row.attentionCount)}` : ''
  const floor = isPartial ? ' or more' : ''
  const spent = tokens === undefined ? '' : `, ${formatTotal(tokens, false)}${floor} tokens`
  return `${row.label}, ${agentCountLabel(row.agentCount)}${waiting}${spent}`
}

interface ZoneButtonProps {
  row: RowCounts
  // Absent until one of the zone's sessions has been counted.
  tokens: number | undefined
  // A session under this zone is still being counted, so the total is a floor.
  isPartial: boolean
  focusedZoneId: string | null
  onFlyToZone: (zoneId: string) => void
  // The zone's name, set in the face its level uses.
  children: ReactNode
}

// Flies the camera to a company or project. A row without a zone yet is shown, not clickable.
export function ZoneButton({
  row,
  tokens,
  isPartial,
  focusedZoneId,
  onFlyToZone,
  children
}: ZoneButtonProps) {
  const isCurrent = row.zoneId !== null && row.zoneId === focusedZoneId
  return (
    <button
      type="button"
      aria-label={rowName(row, tokens, isPartial)}
      aria-current={isCurrent ? 'true' : undefined}
      disabled={row.zoneId === null}
      onClick={() => row.zoneId && onFlyToZone(row.zoneId)}
      className={ROW_CLASS}
    >
      {children}
      {row.attentionCount > 0 && (
        <span className="flex items-center gap-0.5 text-xs font-semibold text-text-primary">
          <Diamond aria-hidden="true" className="size-3 fill-seal stroke-paper" />
          {row.attentionCount}
        </span>
      )}
      <span className="text-caption tabular-nums text-text-tertiary">{row.agentCount}</span>
      {tokens !== undefined && (
        <span className="min-w-[2.75rem] text-right text-xs tabular-nums text-accent">
          {formatTotal(tokens, isPartial)}
        </span>
      )}
    </button>
  )
}

interface ThemeToggleProps {
  zoneLabel: string
  theme: OfficeTheme
  isOpen: boolean
  onToggle: () => void
  buttonRef: (element: HTMLButtonElement | null) => void
}

// The swatch is the theme's own lacquer and gold; its name is in the label and the tooltip.
export function ThemeToggle({ zoneLabel, theme, isOpen, onToggle, buttonRef }: ThemeToggleProps) {
  const name = `Theme for ${zoneLabel}: ${theme.label}`
  return (
    <button
      type="button"
      ref={buttonRef}
      aria-label={name}
      title={name}
      aria-expanded={isOpen}
      onClick={onToggle}
      className={ICON_BUTTON_CLASS}
    >
      <span
        aria-hidden="true"
        className="size-3.5 rounded-sm ring-1 ring-border-strong"
        style={{
          background: `linear-gradient(135deg, ${theme.palette.lacquer} 50%, ${theme.palette.gold} 50%)`
        }}
      />
    </button>
  )
}
