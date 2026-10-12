import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { InteractionFailure, InteractionResult } from '../../../shared/office/types'
import { BUTTON_QUIET_COMPACT_CLASS } from '../../components/deck/deck-styles'
import { failureMessage, MAX_MESSAGE_CHARS, messageProblem } from '../logic/interactions'
import { FIELD_CLASS, KBD_CLASS } from './hud-styles'
import { useRequest } from './use-request'

const SENT_VISIBLE_MS = 2500
const FAILED: InteractionResult = { success: false }

interface TalkBoxProps {
  // A session, or a teammate keyed `${sessionKey}#${memberId}`.
  agentKey: string
  agentName: string
  send: (sessionKey: string, text: string) => Promise<InteractionResult>
  onSent: (agentKey: string) => void
}

export function TalkBox({ agentKey, agentName, send, onSent }: TalkBoxProps) {
  const fieldId = useId()
  const [text, setText] = useState('')
  const [localProblem, setLocalProblem] = useState<InteractionFailure | null>(null)
  const [isSentVisible, setIsSentVisible] = useState(false)
  const [request, run] = useRequest(FAILED)
  const isPending = request.status === 'pending'

  useEffect(() => {
    if (!isSentVisible) return
    const timer = setTimeout(() => setIsSentVisible(false), SENT_VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [isSentVisible])

  const submit = async (): Promise<void> => {
    const problem = messageProblem(text)
    setLocalProblem(problem)
    setIsSentVisible(false)
    if (problem || isPending) return
    const result = await run(() => send(agentKey, text.trim()))
    if (!result.success) return
    setText('')
    setIsSentVisible(true)
    onSent(agentKey)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    void submit()
  }

  const failed = request.status === 'done' && !request.result.success ? request.result : null
  const statusText = localProblem
    ? failureMessage(localProblem)
    : isPending
      ? 'Sending…'
      : isSentVisible
        ? 'Sent'
        : failed
          ? failureMessage(failed.reason)
          : ''

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="text-caption text-text-secondary">
        Message {agentName}
      </label>
      <textarea
        id={fieldId}
        value={text}
        rows={2}
        maxLength={MAX_MESSAGE_CHARS}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        className={FIELD_CLASS}
      />
      <div className="flex items-center justify-between gap-2">
        <p aria-live="polite" className="min-w-0 text-xs text-text-secondary">
          {statusText}
        </p>
        <button
          type="button"
          disabled={isPending}
          aria-keyshortcuts="Meta+Enter"
          onClick={() => void submit()}
          className={BUTTON_QUIET_COMPACT_CLASS}
        >
          Send
          <kbd aria-hidden="true" className={KBD_CLASS}>
            ⌘↵
          </kbd>
        </button>
      </div>
    </div>
  )
}
