import { cn } from '../../lib/utils'
import { PANEL_CLASS } from './hud-styles'

// Until the bridge's first snapshot arrives the office cannot know whether anything runs.
export function EmptyState({ isConnecting }: { isConnecting: boolean }) {
  return (
    <div className={cn(PANEL_CLASS, 'flex max-w-sm flex-col gap-1.5 p-5 text-center')}>
      <h2 className="text-heading text-text-primary">
        {isConnecting ? 'Connecting to your agents…' : 'No agents running'}
      </h2>
      <p className="text-body text-text-secondary">
        {isConnecting
          ? 'Reading the sessions on this Mac. This takes a moment the first time.'
          : "Start a Claude Code or Codex session and it gets an office here, inside its project's office."}
      </p>
    </div>
  )
}
