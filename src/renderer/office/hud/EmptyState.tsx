import { PLATE_TITLE_CLASS } from '../../components/deck/deck-styles'
import { Plate } from '../../components/deck/Plate'

// Until the bridge's first snapshot arrives the office cannot know whether anything runs.
export function EmptyState({ isConnecting }: { isConnecting: boolean }) {
  return (
    <Plate className="max-w-sm" faceClassName="flex flex-col gap-1.5 p-5">
      <h2 className={PLATE_TITLE_CLASS}>
        {isConnecting ? 'Connecting to your agents…' : 'No agents running'}
      </h2>
      <p className="text-body text-text-secondary">
        {isConnecting
          ? 'Reading the sessions on this Mac. This takes a moment the first time.'
          : "Start a Claude Code, Codex or OpenCode session and it gets an office here, inside its project's office."}
      </p>
    </Plate>
  )
}
