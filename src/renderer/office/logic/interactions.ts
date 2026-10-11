import type { InteractionFailure, SessionRef } from '../../../shared/office/types'

export const MAX_MESSAGE_CHARS = 4000
const PLATE_SEPARATOR = '~'

type Reachable = Pick<SessionRef, 'host'>

// Talk and peek drive the agent's Orca pane, so only Orca-hosted sessions can be reached.
export function canTalk(session: Reachable): boolean {
  return session.host === 'orca'
}

export function canPeek(session: Reachable): boolean {
  return session.host === 'orca'
}

export function canRespond(session: Pick<SessionRef, 'host' | 'provider' | 'attention'>): boolean {
  return (
    session.host === 'orca' && session.provider === 'claude' && session.attention === 'permission'
  )
}

const FAILURE_COPY: Record<InteractionFailure, string> = {
  'not-in-orca': 'This agent runs in a plain terminal. Use Jump to terminal to reply there.',
  'orca-unavailable': "Orca isn't responding. Check that it's running.",
  'terminal-not-found': "Couldn't find this agent's Orca pane. It may have closed.",
  'no-permission-prompt': 'No permission prompt is showing for this agent right now.',
  'unsupported-provider':
    'Answering prompts from the office works for Claude agents. Jump to the terminal for Codex.',
  'invalid-input': 'Type a message first (up to 4000 characters).',
  'unknown-session': 'This agent has left the office.'
}

export function failureMessage(reason: InteractionFailure | undefined): string {
  return reason ? FAILURE_COPY[reason] : "That didn't go through. Try again."
}

export function messageProblem(text: string): InteractionFailure | null {
  const trimmed = text.trim()
  return trimmed.length === 0 || trimmed.length > MAX_MESSAGE_CHARS ? 'invalid-input' : null
}

// Overflow floors of one project share its key with a `~plate` suffix.
export function projectKeyForFloor(floorId: string): string {
  return floorId.split(PLATE_SEPARATOR)[0]
}
