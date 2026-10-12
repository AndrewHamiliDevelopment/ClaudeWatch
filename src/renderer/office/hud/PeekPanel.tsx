import { Eye } from 'lucide-react'
import type { PeekResult } from '../../../shared/office/types'
import { BUTTON_QUIET_COMPACT_CLASS } from '../../components/deck/deck-styles'
import { cn } from '../../lib/utils'
import { failureMessage } from '../logic/interactions'
import { ScreenExcerpt } from './ScreenExcerpt'
import { useRequest } from './use-request'

const FAILED: PeekResult = { success: false, lines: [] }

// On demand only: no polling, so the agent's screen is read when the owner asks and not otherwise.
export function PeekPanel({
  agentKey,
  peek
}: {
  agentKey: string
  peek: (sessionKey: string) => Promise<PeekResult>
}) {
  const [request, run] = useRequest(FAILED)
  const load = (): void => void run(() => peek(agentKey))
  const result = request.status === 'done' ? request.result : null

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={request.status === 'pending'}
        onClick={load}
        className={cn(BUTTON_QUIET_COMPACT_CLASS, 'self-start')}
      >
        <Eye aria-hidden="true" className="size-3.5" />
        {request.status === 'idle' ? 'Peek at screen' : 'Refresh'}
      </button>
      {result?.success && <ScreenExcerpt lines={result.lines} />}
      <p aria-live="polite" className="text-xs text-text-secondary">
        {request.status === 'pending'
          ? 'Reading the screen…'
          : result && !result.success
            ? failureMessage(result.reason)
            : ''}
      </p>
    </div>
  )
}
