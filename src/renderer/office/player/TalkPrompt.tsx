import { KBD_CLASS } from '../hud/hud-styles'
import { WALK_KEYS } from '../logic/hotkeys'

// Shown over the agent the player stands beside: the key that selects it, which opens the inspector.
export function TalkPrompt({ label }: { label: string }) {
  return (
    <p className="pointer-events-none flex items-center gap-1.5 whitespace-nowrap rounded-md border border-border-strong bg-surface px-2 py-1 text-xs font-medium text-text-primary shadow-md">
      <kbd className={KBD_CLASS}>{WALK_KEYS.talk}</kbd>
      Talk to {label}
    </p>
  )
}
