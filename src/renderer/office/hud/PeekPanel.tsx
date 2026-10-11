import type { PeekResult } from '../../../shared/office/types'
import { cn } from '../../lib/utils'
import { failureMessage } from '../logic/interactions'
import { FOCUS_RING_CLASS, HUD_BUTTON_CLASS } from './hud-styles'
import { ScreenExcerpt } from './ScreenExcerpt'
import { useRequest } from './use-request'

const FAILED: PeekResult = { success: false, lines: [] }

// On demand only: no polling, so the agent's screen is read when the owner asks and not otherwise.
export function PeekPanel({
  sessionKey,
  peek
}: {
  sessionKey: string
  peek: (sessionKey: string) => Promise<PeekResult>
}) {
  const [request, run] = useRequest(FAILED)
  const load = (): void => void run(() => peek(sessionKey))
  const result = request.status === 'done' ? request.result : null

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={request.status === 'pending'}
        onClick={load}
        className={cn(HUD_BUTTON_CLASS, FOCUS_RING_CLASS, 'self-start bg-surface-hover')}
      >
        {request.status === 'idle' ? 'Peek at screen' : 'Refresh'}
      </button>
      {result?.success && <ScreenExcerpt lines={result.lines} />}
      <p aria-live="polite" className="text-caption text-text-secondary">
        {request.status === 'pending'
          ? 'Reading the screen…'
          : result && !result.success
            ? failureMessage(result.reason)
            : ''}
      </p>
    </div>
  )
}
