import { useState } from 'react'
import type { InteractionResult, ProviderId } from '../../../shared/office/types'
import { cn } from '../../lib/utils'
import { failureMessage } from '../logic/interactions'
import { PROVIDER_LABEL } from '../office-palette'
import { FOCUS_RING_CLASS, HUD_BUTTON_CLASS } from './hud-styles'
import { useRequest } from './use-request'

const FAILED: InteractionResult = { success: false }
const PROVIDERS: readonly ProviderId[] = ['claude', 'codex']

interface NewAgentMenuProps {
  floorLabel: string
  onStart: (provider: ProviderId) => Promise<InteractionResult>
  onDismiss: () => void
}

// The new robot is not drawn here: it appears when the live feed reports the session.
export function NewAgentMenu({ floorLabel, onStart, onDismiss }: NewAgentMenuProps) {
  const [request, run] = useRequest(FAILED)
  const [chosen, setChosen] = useState<ProviderId | null>(null)

  const start = (provider: ProviderId): void => {
    setChosen(provider)
    void run(() => onStart(provider))
  }

  const statusText =
    request.status === 'pending'
      ? 'Starting…'
      : request.status === 'done' && chosen
        ? request.result.success
          ? `Starting a ${PROVIDER_LABEL[chosen]} agent on ${floorLabel}. It shows up here when it's ready.`
          : failureMessage(request.result.reason)
        : ''

  return (
    <div
      className="flex flex-col gap-1.5 py-1.5 pl-8 pr-1"
      onKeyDown={(event) => {
        if (event.key === 'Escape') onDismiss()
      }}
    >
      <div className="flex gap-1.5" role="group" aria-label={`Start an agent on ${floorLabel}`}>
        {PROVIDERS.map((provider) => (
          <button
            key={provider}
            type="button"
            aria-label={`Start ${PROVIDER_LABEL[provider]} agent`}
            disabled={request.status === 'pending'}
            onClick={() => start(provider)}
            className={cn(HUD_BUTTON_CLASS, FOCUS_RING_CLASS, 'bg-surface-hover')}
          >
            {PROVIDER_LABEL[provider]}
          </button>
        ))}
      </div>
      <p aria-live="polite" className="text-caption text-text-secondary">
        {statusText}
      </p>
    </div>
  )
}
