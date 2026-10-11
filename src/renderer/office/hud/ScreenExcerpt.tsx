import { cn } from '../../lib/utils'
import { FOCUS_RING_CLASS } from './hud-styles'

// The agent's rendered terminal lines. Held in component state only: never stored, never logged.
export function ScreenExcerpt({ lines }: { lines: readonly string[] }) {
  return (
    <pre
      aria-label="Screen excerpt"
      tabIndex={0}
      className={cn(
        FOCUS_RING_CLASS,
        'max-h-60 overflow-auto whitespace-pre rounded-md border border-border bg-surface p-2 font-mono text-[11px] leading-snug text-text-primary'
      )}
    >
      {lines.length > 0 ? lines.join('\n') : 'The screen is empty.'}
    </pre>
  )
}
