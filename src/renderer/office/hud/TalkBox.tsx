import { useEffect, useId, useState, type KeyboardEvent } from 'react'
import type { InteractionFailure, InteractionResult } from '../../../shared/office/types'
import { cn } from '../../lib/utils'
import { failureMessage, MAX_MESSAGE_CHARS, messageProblem } from '../logic/interactions'
import { FOCUS_RING_CLASS, HUD_BUTTON_CLASS, KBD_CLASS } from './hud-styles'
import { useRequest } from './use-request'

const SENT_VISIBLE_MS = 2500
const FAILED: InteractionResult = { success: false }

interface TalkBoxProps {
  sessionKey: string
  sessionName: string
  send: (sessionKey: string, text: string) => Promise<InteractionResult>
  onSent: (sessionKey: string) => void
}

export function TalkBox({ sessionKey, sessionName, send, onSent }: TalkBoxProps) {
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
    const result = await run(() => send(sessionKey, text.trim()))
    if (!result.success) return
    setText('')
    setIsSentVisible(true)
    onSent(sessionKey)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>): void => {
    if (event.key !== 'Enter' || !(event.metaKey || event.ctrlKey)) return
    event.preventDefault()
    void submit()
  }

  const failure =
    request.status === 'done' && !request.result.success ? request.result.reason : null
  const statusText = localProblem
    ? failureMessage(localProblem)
    : isPending
      ? 'Sending…'
      : isSentVisible
        ? 'Sent'
        : request.status === 'done' && !request.result.success
          ? failureMessage(failure ?? undefined)
          : ''

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="sr-only">
        Message {sessionName}
      </label>
      <textarea
        id={fieldId}
        value={text}
        rows={2}
        maxLength={MAX_MESSAGE_CHARS}
        placeholder={`Message ${sessionName}…`}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={onKeyDown}
        className={cn(
          FOCUS_RING_CLASS,
          'resize-none rounded-md border border-border-strong bg-surface px-2 py-1.5 text-body text-text-primary placeholder:text-text-secondary'
        )}
      />
      <div className="flex items-center justify-between gap-2">
        <p aria-live="polite" className="min-w-0 text-caption text-text-secondary">
          {statusText}
        </p>
        <button
          type="button"
          disabled={isPending}
          aria-keyshortcuts="Meta+Enter"
          onClick={() => void submit()}
          className={cn(
            HUD_BUTTON_CLASS,
            FOCUS_RING_CLASS,
            'flex shrink-0 items-center gap-1.5 bg-surface-hover'
          )}
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
