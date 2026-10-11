import { X } from 'lucide-react'
import { ICON_BUTTON_CLASS } from '../../components/deck/deck-styles'
import { Plate } from '../../components/deck/Plate'

// Where Focus terminal landed when it was not the agent's own pane. The live region stays
// mounted while empty so a screen reader hears the message arrive.
export function FocusNotice({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div aria-live="polite">
      {message && (
        <Plate className="max-w-md" faceClassName="flex items-start gap-2 py-2 pl-3 pr-2">
          <p className="flex-1 text-xs text-text-primary">{message}</p>
          <button
            type="button"
            aria-label="Dismiss"
            onClick={onDismiss}
            className={ICON_BUTTON_CLASS}
          >
            <X aria-hidden="true" className="size-4" />
          </button>
        </Plate>
      )}
    </div>
  )
}
