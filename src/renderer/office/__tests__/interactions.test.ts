import { describe, expect, it } from 'vitest'
import {
  canPeek,
  canRespond,
  canTalk,
  failureMessage,
  MAX_MESSAGE_CHARS,
  messageProblem
} from '../logic/interactions'
import { INITIAL_OFFICE_STATE, officeReducer } from '../logic/office-reducer'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession } from './fixtures'

describe('availability', () => {
  const orcaClaude = makeSession({ key: 'claude:a', host: 'orca', attention: 'permission' })

  it('lets talk and peek reach only Orca sessions', () => {
    expect(canTalk(orcaClaude)).toBe(true)
    expect(canPeek(orcaClaude)).toBe(true)
    expect(canTalk(makeSession({ key: 'claude:t', host: 'terminal' }))).toBe(false)
    expect(canPeek(makeSession({ key: 'claude:t', host: 'vscode' }))).toBe(false)
  })

  it('answers prompts only for Claude in Orca with a permission prompt showing', () => {
    expect(canRespond(orcaClaude)).toBe(true)
    expect(canRespond({ ...orcaClaude, provider: 'codex' })).toBe(false)
    expect(canRespond({ ...orcaClaude, host: 'terminal' })).toBe(false)
    expect(canRespond({ ...orcaClaude, attention: 'question' })).toBe(false)
  })
})

describe('failureMessage', () => {
  it('has plain words for every failure', () => {
    expect(failureMessage('not-in-orca')).toBe(
      'This agent runs in a plain terminal. Use Jump to terminal to reply there.'
    )
    expect(failureMessage('orca-unavailable')).toBe(
      "Orca isn't responding. Check that it's running."
    )
    expect(failureMessage('terminal-not-found')).toBe(
      "Couldn't find this agent's Orca pane. It may have closed."
    )
    expect(failureMessage('no-permission-prompt')).toBe(
      'No permission prompt is showing for this agent right now.'
    )
    expect(failureMessage('unsupported-provider')).toBe(
      'Answering prompts from the office works for Claude agents. Jump to the terminal for Codex.'
    )
    expect(failureMessage('invalid-input')).toBe('Type a message first (up to 4000 characters).')
    expect(failureMessage('unknown-session')).toBe('This agent has left the office.')
  })

  it('still says something when the reason is missing', () => {
    expect(failureMessage(undefined)).toMatch(/try again/i)
  })
})

describe('messageProblem', () => {
  it('rejects blank and over-long messages before they reach the feed', () => {
    expect(messageProblem('   ')).toBe('invalid-input')
    expect(messageProblem('x'.repeat(MAX_MESSAGE_CHARS + 1))).toBe('invalid-input')
    expect(messageProblem('ship it')).toBeNull()
  })
})

describe('review state', () => {
  const frame = makeFrame({
    floors: [makeFloor({ floorId: 'f1', rooms: [makeRoom({ id: 'r1', sessionKey: 'claude:a' })] })],
    sessions: [makeSession({ key: 'claude:a', attention: 'permission' })],
    agents: [makeAgent({ agentKey: 'a', roomId: 'r1', attention: 'permission' })]
  })
  const loaded = officeReducer(INITIAL_OFFICE_STATE, { type: 'frame-received', frame })

  it('opens a review by selecting the agent and remembering the session', () => {
    const state = officeReducer(loaded, { type: 'review-opened', sessionKey: 'claude:a' })
    expect(state).toMatchObject({ selectedAgentKey: 'a', reviewingSessionKey: 'claude:a' })
    expect(officeReducer(state, { type: 'review-closed' }).reviewingSessionKey).toBeNull()
  })

  it('drops the review when another agent is selected', () => {
    const state = officeReducer(loaded, { type: 'review-opened', sessionKey: 'claude:a' })
    expect(
      officeReducer(state, { type: 'agent-selected', agentKey: null }).reviewingSessionKey
    ).toBeNull()
  })
})
