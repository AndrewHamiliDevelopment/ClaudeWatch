import { cn } from '../../lib/utils'
import type { FloorSummary } from '../logic/floor-model'
import { STATE_COLOR } from '../office-palette'
import { FOCUS_RING_CLASS, KBD_CLASS, PANEL_CLASS } from './hud-styles'

interface ElevatorPanelProps {
  floors: readonly FloorSummary[]
  focusedFloorId: string | null
  onSelect: (floorId: string) => void
}

function floorName(floor: FloorSummary): string {
  const agents = `${floor.agentCount} ${floor.agentCount === 1 ? 'agent' : 'agents'}`
  const waiting = floor.attentionCount > 0 ? `, ${floor.attentionCount} need you` : ''
  return `Floor ${floor.number}, ${floor.label}, ${agents}${waiting}`
}

// A building cross-section: top floor first, the lit car marks the floor in view.
export function ElevatorPanel({ floors, focusedFloorId, onSelect }: ElevatorPanelProps) {
  const topFirst = [...floors].reverse()
  return (
    <nav aria-label="Floors" className={cn(PANEL_CLASS, 'flex flex-col gap-2 p-3')}>
      <div className="flex items-center justify-between">
        <h2 className="text-heading text-text-primary">Floors</h2>
        <span className="flex gap-1" aria-hidden="true">
          <kbd className={KBD_CLASS}>[</kbd>
          <kbd className={KBD_CLASS}>]</kbd>
        </span>
      </div>
      <ol className="flex flex-col border-l-2 border-border-strong">
        {topFirst.map((floor) => {
          const isFocused = floor.floorId === focusedFloorId
          return (
            <li key={floor.floorId}>
              <button
                type="button"
                aria-label={floorName(floor)}
                aria-current={isFocused ? 'true' : undefined}
                onClick={() => onSelect(floor.floorId)}
                className={cn(
                  FOCUS_RING_CLASS,
                  '-ml-0.5 flex w-full items-center gap-2 border-l-2 border-transparent py-1.5 pl-2.5 pr-1 text-left transition-colors hover:bg-surface-hover',
                  isFocused && 'border-accent bg-accent-muted'
                )}
              >
                <span className="w-4 text-right font-mono text-mono-sm tabular-nums text-text-secondary">
                  {floor.number}
                </span>
                <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                  {floor.label}
                </span>
                {floor.attentionCount > 0 && (
                  <span className="flex items-center gap-0.5 text-mono-sm text-text-primary">
                    <span style={{ color: STATE_COLOR.permission }}>!</span>
                    {floor.attentionCount}
                  </span>
                )}
                <span className="min-w-[1.25rem] text-right font-mono text-mono-sm tabular-nums text-text-secondary">
                  {floor.agentCount}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
