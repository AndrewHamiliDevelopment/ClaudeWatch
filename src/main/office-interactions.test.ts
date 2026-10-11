import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OfficeInteractions } from './office-interactions'
import type { OfficeSnapshot, SessionRef } from '../shared/office/types'

const session = (overrides: Partial<SessionRef> = {}): SessionRef => ({
  key: 'claude:s1',
  provider: 'claude',
  sessionId: 's1',
  pid: 1,
  name: 'app',
  cwd: '/repo/app',
  projectKey: 'p_app',
  projectLabel: 'app',
  worktree: null,
  host: 'orca',
  orcaPaneKey: 'tab1:leaf1',
  activity: 'editing',
  attention: 'none',
  currentTool: null,
  subagents: [],
  startedAtMs: 1,
  updatedAtMs: 1,
  ...overrides
})

const PROMPT_SCREEN = [
  'Bash command',
  '  npm test',
  'Do you want to proceed?',
  '❯ 1. Yes',
  '  2. No'
]

describe('OfficeInteractions', () => {
  let snapshot: OfficeSnapshot
  const orca = {
    handleFor: vi.fn(),
    sendPrompt: vi.fn(),
    sendKey: vi.fn(),
    screen: vi.fn(),
    create: vi.fn()
  }
  const openTerminalRunning = vi.fn()
  let interactions: OfficeInteractions

  beforeEach(() => {
    vi.resetAllMocks()
    orca.handleFor.mockResolvedValue('term_a')
    orca.screen.mockResolvedValue(PROMPT_SCREEN)
    openTerminalRunning.mockResolvedValue({ success: true })
    snapshot = { rev: 1, generatedAtMs: 1, sessions: [session()], sources: [] }
    interactions = new OfficeInteractions({ snapshot: () => snapshot, orca, openTerminalRunning })
  })

  describe('send', () => {
    it('types the message into the agent’s Orca terminal', async () => {
      expect(await interactions.send('claude:s1', 'run the tests')).toEqual({ success: true })
      expect(orca.sendPrompt).toHaveBeenCalledWith('term_a', 'run the tests')
    })

    it('refuses sessions outside Orca, empty or control-character text, and unknown sessions', async () => {
      snapshot.sessions = [session({ host: 'terminal', orcaPaneKey: null })]
      expect(await interactions.send('claude:s1', 'hi')).toEqual({
        success: false,
        reason: 'not-in-orca'
      })
      snapshot.sessions = [session()]
      expect(await interactions.send('claude:s1', '   ')).toEqual({
        success: false,
        reason: 'invalid-input'
      })
      expect(await interactions.send('claude:s1', 'hi\u001b[A')).toEqual({
        success: false,
        reason: 'invalid-input'
      })
      expect(await interactions.send('claude:s1', 'x'.repeat(4001))).toEqual({
        success: false,
        reason: 'invalid-input'
      })
      expect(await interactions.send('claude:nope', 'hi')).toEqual({
        success: false,
        reason: 'unknown-session'
      })
      expect(orca.sendPrompt).not.toHaveBeenCalled()
    })

    it('reports a missing terminal and an unreachable Orca', async () => {
      orca.handleFor.mockResolvedValueOnce(null)
      expect(await interactions.send('claude:s1', 'hi')).toEqual({
        success: false,
        reason: 'terminal-not-found'
      })
      orca.handleFor.mockRejectedValueOnce(new Error('ECONNREFUSED'))
      expect(await interactions.send('claude:s1', 'hi')).toEqual({
        success: false,
        reason: 'orca-unavailable'
      })
    })
  })

  describe('respond', () => {
    beforeEach(() => {
      snapshot.sessions = [session({ attention: 'permission' })]
    })

    it('approves with key 1 and denies with Escape when a permission prompt is on screen', async () => {
      expect(await interactions.respond('claude:s1', 'approve')).toEqual({ success: true })
      expect(orca.sendKey).toHaveBeenLastCalledWith('term_a', '1')
      expect(await interactions.respond('claude:s1', 'deny')).toEqual({ success: true })
      expect(orca.sendKey).toHaveBeenLastCalledWith('term_a', '\u001b')
    })

    it('sends nothing when the screen shows no permission prompt', async () => {
      orca.screen.mockResolvedValue(['$ vim notes.md'])
      expect(await interactions.respond('claude:s1', 'approve')).toEqual({
        success: false,
        reason: 'no-permission-prompt'
      })
      expect(orca.sendKey).not.toHaveBeenCalled()
    })

    it('refuses sessions that are not waiting for permission, and Codex sessions', async () => {
      snapshot.sessions = [session({ attention: 'none' })]
      expect(await interactions.respond('claude:s1', 'approve')).toEqual({
        success: false,
        reason: 'no-permission-prompt'
      })
      snapshot.sessions = [session({ provider: 'codex', attention: 'permission' })]
      expect(await interactions.respond('claude:s1', 'approve')).toEqual({
        success: false,
        reason: 'unsupported-provider'
      })
      expect(orca.sendKey).not.toHaveBeenCalled()
    })

    it('rejects an unknown decision', async () => {
      expect(await interactions.respond('claude:s1', 'maybe' as 'approve')).toEqual({
        success: false,
        reason: 'invalid-input'
      })
    })
  })

  describe('peek', () => {
    it('returns the last rendered screen lines without trailing blanks', async () => {
      orca.screen.mockResolvedValue(['a', 'b', '', '  '])
      expect(await interactions.peek('claude:s1')).toEqual({ success: true, lines: ['a', 'b'] })
    })

    it('caps the result at 40 lines', async () => {
      orca.screen.mockResolvedValue(Array.from({ length: 100 }, (_, i) => `line ${i}`))
      const peeked = await interactions.peek('claude:s1')
      expect(peeked.lines).toHaveLength(40)
      expect(peeked.lines.at(-1)).toBe('line 99')
    })

    it('refuses sessions outside Orca', async () => {
      snapshot.sessions = [session({ host: 'terminal', orcaPaneKey: null })]
      expect(await interactions.peek('claude:s1')).toEqual({
        success: false,
        reason: 'not-in-orca',
        lines: []
      })
    })
  })

  describe('start', () => {
    it('opens a new Orca terminal running the chosen agent in the project folder', async () => {
      expect(await interactions.start('p_app', 'codex')).toEqual({ success: true })
      expect(orca.create).toHaveBeenCalledWith('/repo/app', 'codex', 'New Codex agent')
    })

    it('prefers the worktree path when the session runs in one', async () => {
      snapshot.sessions = [session({ worktree: '/repo/app-wt' })]
      await interactions.start('p_app', 'claude')
      expect(orca.create).toHaveBeenCalledWith('/repo/app-wt', 'claude', 'New Claude agent')
    })

    it('falls back to Terminal.app when Orca cannot create the terminal', async () => {
      orca.create.mockRejectedValueOnce(new Error('runtime not running'))
      expect(await interactions.start('p_app', 'claude')).toEqual({ success: true })
      expect(openTerminalRunning).toHaveBeenCalledWith('/repo/app', 'claude')
    })

    it('refuses an unknown project or provider', async () => {
      expect(await interactions.start('p_missing', 'claude')).toEqual({
        success: false,
        reason: 'unknown-session'
      })
      expect(await interactions.start('p_app', 'bash' as 'claude')).toEqual({
        success: false,
        reason: 'invalid-input'
      })
      expect(orca.create).not.toHaveBeenCalled()
    })
  })
})
