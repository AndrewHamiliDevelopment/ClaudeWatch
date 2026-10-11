import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OfficeInteractions } from './office-interactions'
import type { OfficeSnapshot, SessionRef } from '../shared/office/types'
import type { PaneTerminal } from './orca-terminals'

const session = (overrides: Partial<SessionRef> = {}): SessionRef => ({
  key: 'claude:s1',
  provider: 'claude',
  sessionId: 's1',
  pid: 1,
  name: 'app',
  cwd: '/repo/app',
  projectKey: 'p_app',
  projectLabel: 'app',
  projectRoot: '/repo/app',
  companyKey: 'c_test',
  companyLabel: 'Test Co',
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

const pane = (overrides: Partial<PaneTerminal> = {}): PaneTerminal => ({
  handle: 'term_a',
  worktreePath: '/repo/app',
  agent: 'claude',
  incarnationId: 'inc_1',
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
  const processStart = vi.fn()
  let interactions: OfficeInteractions

  beforeEach(() => {
    vi.resetAllMocks()
    orca.handleFor.mockResolvedValue(pane())
    orca.screen.mockResolvedValue(PROMPT_SCREEN)
    openTerminalRunning.mockResolvedValue({ success: true })
    processStart.mockResolvedValue(1)
    snapshot = { rev: 1, generatedAtMs: 1, sessions: [session()], sources: [] }
    interactions = new OfficeInteractions({
      snapshot: () => snapshot,
      orca,
      openTerminalRunning,
      processStart
    })
  })

  describe('send', () => {
    it('types the message into the agent’s Orca terminal', async () => {
      expect(await interactions.send('claude:s1', 'run the tests')).toEqual({ success: true })
      expect(orca.sendPrompt).toHaveBeenCalledWith('term_a', 'run the tests')
    })

    it('joins a multi-line message into one line, since a raw newline would submit it early', async () => {
      expect(await interactions.send('claude:s1', 'first line\r\nsecond line\n\nthird')).toEqual({
        success: true
      })
      expect(orca.sendPrompt).toHaveBeenCalledWith('term_a', 'first line second line third')
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

    it('refuses a pane whose worktree is not this session’s folder', async () => {
      orca.handleFor.mockResolvedValueOnce(pane({ handle: 'term_x', worktreePath: '/other/repo' }))
      expect(await interactions.send('claude:s1', 'hi')).toEqual({
        success: false,
        reason: 'terminal-not-found'
      })
      expect(orca.sendPrompt).not.toHaveBeenCalled()
    })

    it('accepts a pane in the project root or in a worktree that contains the session folder', async () => {
      snapshot.sessions = [session({ cwd: '/repo/app-wt/src', projectRoot: '/repo/app' })]
      orca.handleFor.mockResolvedValueOnce(pane({ worktreePath: '/repo/app-wt' }))
      expect(await interactions.send('claude:s1', 'hi')).toEqual({ success: true })
      orca.handleFor.mockResolvedValueOnce(pane())
      expect(await interactions.send('claude:s1', 'hi')).toEqual({ success: true })
      orca.handleFor.mockResolvedValueOnce(pane({ worktreePath: '/repo/app-wt-other' }))
      expect(await interactions.send('claude:s1', 'hi')).toEqual({
        success: false,
        reason: 'terminal-not-found'
      })
    })

    it('refuses a pane where this session’s agent is no longer the running program', async () => {
      for (const agent of [null, 'codex', 'claude-something-else']) {
        orca.handleFor.mockResolvedValueOnce(pane({ agent }))
        expect(await interactions.send('claude:s1', 'rm -rf build')).toEqual({
          success: false,
          reason: 'terminal-not-found'
        })
      }
      expect(orca.sendPrompt).not.toHaveBeenCalled()
    })

    it('refuses a session whose process is gone or whose pid now belongs to another process', async () => {
      for (const start of [null, 999]) {
        processStart.mockResolvedValueOnce(start)
        expect(await interactions.send('claude:s1', 'hi')).toEqual({
          success: false,
          reason: 'unknown-session'
        })
      }
      expect(processStart).toHaveBeenCalledWith(1)
      expect(orca.handleFor).not.toHaveBeenCalled()
      expect(orca.sendPrompt).not.toHaveBeenCalled()
    })

    it('accepts Orca’s agent-teams flavour of the same provider', async () => {
      orca.handleFor.mockResolvedValueOnce(pane({ agent: 'claude-agent-teams' }))
      expect(await interactions.send('claude:s1', 'hi')).toEqual({ success: true })
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

    const reviewed = async (): Promise<string> =>
      (await interactions.peek('claude:s1')).fingerprint!

    it('approves with key 1 and denies with Escape for the prompt the owner reviewed', async () => {
      const fingerprint = await reviewed()
      expect(await interactions.respond('claude:s1', 'approve', fingerprint)).toEqual({
        success: true
      })
      expect(orca.sendKey).toHaveBeenLastCalledWith('term_a', '1')
      expect(await interactions.respond('claude:s1', 'deny', await reviewed())).toEqual({
        success: true
      })
      expect(orca.sendKey).toHaveBeenLastCalledWith('term_a', '\u001b')
    })

    it('answers once per review, even when two answers race', async () => {
      const fingerprint = await reviewed()
      const answers = await Promise.all([
        interactions.respond('claude:s1', 'approve', fingerprint),
        interactions.respond('claude:s1', 'approve', fingerprint)
      ])
      expect(answers).toEqual([{ success: true }, { success: false, reason: 'prompt-changed' }])
      expect(await interactions.respond('claude:s1', 'approve', fingerprint)).toEqual({
        success: false,
        reason: 'prompt-changed'
      })
      expect(orca.sendKey).toHaveBeenCalledOnce()
    })

    it('sends nothing for a fingerprint the office never issued for this session', async () => {
      const { createHash } = await import('crypto')
      const forged = createHash('sha256').update(PROMPT_SCREEN.join('\n')).digest('hex')
      expect(await interactions.respond('claude:s1', 'approve', forged)).toEqual({
        success: false,
        reason: 'prompt-changed'
      })
      expect(orca.sendKey).not.toHaveBeenCalled()
    })

    it('sends nothing when the terminal was restarted after the review', async () => {
      const fingerprint = await reviewed()
      orca.handleFor.mockResolvedValue(pane({ incarnationId: 'inc_2' }))
      expect(await interactions.respond('claude:s1', 'approve', fingerprint)).toEqual({
        success: false,
        reason: 'prompt-changed'
      })
      expect(orca.sendKey).not.toHaveBeenCalled()
    })

    it('sends nothing when a different prompt replaced the reviewed one', async () => {
      const fingerprint = await reviewed()
      orca.screen.mockResolvedValue([
        'Bash command',
        '  rm -rf build',
        'Do you want to proceed?',
        '❯ 1. Yes',
        '  2. No'
      ])
      expect(await interactions.respond('claude:s1', 'approve', fingerprint)).toEqual({
        success: false,
        reason: 'prompt-changed'
      })
      expect(orca.sendKey).not.toHaveBeenCalled()
    })

    it('requires the fingerprint of a reviewed screen', async () => {
      expect(await interactions.respond('claude:s1', 'approve', '')).toEqual({
        success: false,
        reason: 'invalid-input'
      })
      expect(orca.sendKey).not.toHaveBeenCalled()
    })

    it('sends nothing when the screen shows no permission prompt', async () => {
      const fingerprint = await reviewed()
      orca.screen.mockResolvedValue(['$ vim notes.md'])
      expect(await interactions.respond('claude:s1', 'approve', fingerprint)).toEqual({
        success: false,
        reason: 'no-permission-prompt'
      })
      expect(orca.sendKey).not.toHaveBeenCalled()
    })

    it('refuses sessions that are not waiting for permission, and Codex sessions', async () => {
      snapshot.sessions = [session({ attention: 'none' })]
      expect(await interactions.respond('claude:s1', 'approve', 'f')).toEqual({
        success: false,
        reason: 'no-permission-prompt'
      })
      snapshot.sessions = [session({ provider: 'codex', attention: 'permission' })]
      expect(await interactions.respond('claude:s1', 'approve', 'f')).toEqual({
        success: false,
        reason: 'unsupported-provider'
      })
      expect(orca.sendKey).not.toHaveBeenCalled()
    })

    it('rejects an unknown decision', async () => {
      expect(await interactions.respond('claude:s1', 'maybe' as 'approve', 'f')).toEqual({
        success: false,
        reason: 'invalid-input'
      })
    })
  })

  describe('peek', () => {
    it('returns the last rendered screen lines without trailing blanks', async () => {
      orca.screen.mockResolvedValue(['a', 'b', '', '  '])
      expect(await interactions.peek('claude:s1')).toEqual({
        success: true,
        lines: ['a', 'b'],
        fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/)
      })
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

    it('starts in the project root even when the known session runs in a worktree or subfolder', async () => {
      snapshot.sessions = [
        session({ worktree: '/repo/app-wt', cwd: '/repo/app-wt/src', projectRoot: '/repo/app' })
      ]
      await interactions.start('p_app', 'claude')
      expect(orca.create).toHaveBeenCalledWith('/repo/app', 'claude', 'New Claude agent')
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
