import { cn } from '../../lib/utils'
import { PANEL_CLASS } from './hud-styles'

export function EmptyState() {
  return (
    <div className={cn(PANEL_CLASS, 'flex max-w-sm flex-col gap-1.5 p-5 text-center')}>
      <h2 className="text-heading text-text-primary">No agents running</h2>
      <p className="text-body text-text-secondary">
        Start a Claude Code or Codex session and it gets an office here, on its project&apos;s
        floor.
      </p>
    </div>
  )
}
