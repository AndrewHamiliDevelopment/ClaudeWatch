import { useEffect, useId, useState } from 'react'
import type {
  InteractionResult,
  PeekResult,
  PermissionDecision,
  SessionRef
} from '../../../shared/office/types'
import { cn } from '../../lib/utils'
import { failureMessage } from '../logic/interactions'
import { FOCUS_RING_CLASS, HUD_BUTTON_CLASS } from './hud-styles'
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
    <section
      aria-labelledby={headingId}
      className="flex flex-col gap-2 rounded-md border border-border-strong p-2"
    >
      <h3 id={headingId} className="text-heading text-text-primary">
        Permission request
      </h3>
      {screenResult?.success && <ScreenExcerpt lines={screenResult.lines} />}
      <p aria-live="polite" className="text-caption text-text-secondary">
        {statusText}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!canDecide}
          onClick={() => decide('approve')}
          className={cn(
            HUD_BUTTON_CLASS,
            FOCUS_RING_CLASS,
            'bg-accent-hover font-medium text-white hover:bg-accent-hover/90'
          )}
        >
          Approve
        </button>
        <button
          type="button"
          disabled={!canDecide}
          onClick={() => decide('deny')}
          className={cn(HUD_BUTTON_CLASS, FOCUS_RING_CLASS, 'bg-surface-hover')}
        >
          Deny
        </button>
        {screenResult && !screenResult.success && (
          <button
            type="button"
            onClick={() => void loadScreen(() => peek(session.key))}
            className={cn(HUD_BUTTON_CLASS, FOCUS_RING_CLASS)}
          >
            Try again
          </button>
        )}
        <button type="button" onClick={onClose} className={cn(HUD_BUTTON_CLASS, FOCUS_RING_CLASS)}>
          Close review
        </button>
      </div>
    </section>
  )
}
