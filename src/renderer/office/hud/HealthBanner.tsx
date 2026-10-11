import { TriangleAlert } from 'lucide-react'
import type { SourceHealth } from '../../../shared/office/types'
import { cn } from '../../lib/utils'
import { STATE_COLOR } from '../office-palette'
import { PANEL_CLASS } from './hud-styles'

// Non-blocking: lists only the failing sources, in the words the bridge reports.
export function HealthBanner({ sources }: { sources: readonly SourceHealth[] }) {
  const failing = sources.filter((source) => !source.ok)
  return (
    <section
      aria-label="Source health"
      aria-live="polite"
      className={cn(failing.length > 0 && PANEL_CLASS, failing.length > 0 && 'px-3 py-2')}
    >
      {failing.length > 0 && (
        <ul className="flex flex-col gap-1">
          {failing.map((source) => (
            <li key={source.id} className="flex items-start gap-2 text-caption text-text-primary">
              <TriangleAlert
                aria-hidden="true"
                className="mt-px size-3.5 shrink-0"
                style={{ color: STATE_COLOR.error }}
              />
              <span>{source.detail || `${source.id} is not responding`}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
