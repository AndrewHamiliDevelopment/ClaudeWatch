import { useEffect, useId, useState } from 'react'
import type {
  InteractionResult,
  PeekResult,
  PermissionDecision,
  SessionRef
} from '../../../shared/office/types'
import { BUTTON_INK_CLASS, BUTTON_INK_QUIET_CLASS } from '../../components/deck/deck-styles'
import { Seal, SLIP_CLASS } from '../../components/deck/WorkOrderSlip'
import { cn } from '../../lib/utils'
import { failureMessage } from '../logic/interactions'
import { ScreenExcerpt } from './ScreenExcerpt'
import { useRequest } from './use-request'

const PEEK_FAILED: PeekResult = { success: false, lines: [] }
const RESPOND_FAILED: InteractionResult = { success: false }
const DECISION_DONE: Record<PermissionDecision, string> = {
  approve: 'Approved. Waiting for the agent to carry on…',
  deny: 'Denied. Waiting for the agent to carry on…'
}

interface PermissionPanelProps {
  session: SessionRef
  peek: (sessionKey: string) => Promise<PeekResult>
  respond: (
    sessionKey: string,
    decision: PermissionDecision,
    fingerprint: string
  ) => Promise<InteractionResult>
  onClose: () => void
}

// The owner sees the exact prompt (via peek) before Approve or Deny are offered. After a decision
// the panel stays until a frame shows the prompt cleared, so nothing is assumed.
export function PermissionPanel({ session, peek, respond, onClose }: PermissionPanelProps) {
  const headingId = useId()
  const [screen, loadScreen] = useRequest(PEEK_FAILED)
  const [answer, sendAnswer] = useRequest(RESPOND_FAILED)
  const [decision, setDecision] = useState<PermissionDecision | null>(null)

  useEffect(() => {
    void loadScreen(() => peek(session.key))
  }, [loadScreen, peek, session.key])

  const hasAnswered = answer.status === 'done' && answer.result.success
  useEffect(() => {
    if (hasAnswered && session.attention !== 'permission') onClose()
  }, [hasAnswered, session.attention, onClose])

  const screenResult = screen.status === 'done' ? screen.result : null

  // The answer is bound to the screen the owner saw; if it changed, re-read it for a fresh review.
  const decide = (choice: PermissionDecision): void => {
    const fingerprint = screenResult?.fingerprint
    if (!fingerprint) return
    setDecision(choice)
    void sendAnswer(async () => {
      const result = await respond(session.key, choice, fingerprint)
      if (result.reason === 'prompt-changed') void loadScreen(() => peek(session.key))
      return result
    })
  }
  const canDecide =
    Boolean(screenResult?.success && screenResult.fingerprint) &&
    screen.status !== 'pending' &&
    answer.status !== 'pending' &&
    !hasAnswered
  const statusText =
    screen.status === 'pending'
      ? 'Reading the prompt…'
      : screenResult && !screenResult.success
        ? failureMessage(screenResult.reason)
        : answer.status === 'pending'
          ? 'Sending your answer…'
          : answer.status === 'done'
            ? answer.result.success && decision
              ? DECISION_DONE[decision]
              : failureMessage(answer.result.reason)
            : ''

  return (
    <section aria-labelledby={headingId} className={cn(SLIP_CLASS, 'flex flex-col gap-2 p-2.5')}>
      <div className="flex items-center gap-2">
        <Seal attention="permission" />
        <h3 id={headingId} className="pt-[3px] font-plate text-title">
          Permission request
        </h3>
      </div>
      {screenResult?.success && <ScreenExcerpt lines={screenResult.lines} />}
      <p aria-live="polite" className="text-xs text-ink-soft">
        {statusText}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canDecide}
          onClick={() => decide('approve')}
          className={BUTTON_INK_CLASS}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={!canDecide}
          onClick={() => decide('deny')}
          className={BUTTON_INK_QUIET_CLASS}
        >
          Deny
        </button>
        {screenResult && !screenResult.success && (
          <button
            type="button"
            onClick={() => void loadScreen(() => peek(session.key))}
            className={BUTTON_INK_QUIET_CLASS}
          >
            Try again
          </button>
        )}
        <button type="button" onClick={onClose} className={BUTTON_INK_QUIET_CLASS}>
          Close review
        </button>
      </div>
    </section>
  )
}
