import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OfficeInteractions } from './office-interactions'
import type { OfficeSnapshot, SessionRef, SubagentRef } from '../shared/office/types'
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

const teammate: SubagentRef = {
  id: 'lena',
  type: 'lena',
  activity: 'editing',
  kind: 'teammate',
  pid: 77,
  startedAtMs: 5,
  orcaPaneKey: 'tab1:leaf7'
}

describe('OfficeInteractions.focus', () => {
  let snapshot: OfficeSnapshot
  const orca = {
    handleFor: vi.fn(),
    sendPrompt: vi.fn(),
    sendKey: vi.fn(),
    screen: vi.fn(),
    create: vi.fn(),
    focus: vi.fn()
  }
  const openTerminalRunning = vi.fn()
  const processStart = vi.fn()
  const raiseOrca = vi.fn()
  const openFolder = vi.fn()
  let interactions: OfficeInteractions

  const expectNothingTyped = (): void => {
    for (const input of [orca.sendPrompt, orca.sendKey, orca.screen, orca.create]) {
      expect(input).not.toHaveBeenCalled()
    }
  }

  beforeEach(() => {
    vi.resetAllMocks()
    orca.handleFor.mockResolvedValue(pane())
    orca.focus.mockResolvedValue(true)
    processStart.mockResolvedValue(1)
    raiseOrca.mockResolvedValue(true)
    openFolder.mockResolvedValue({ success: true })
    snapshot = { rev: 1, generatedAtMs: 1, sessions: [session()], sources: [] }
    interactions = new OfficeInteractions({
      snapshot: () => snapshot,
      orca,
      openTerminalRunning,
      processStart,
      raiseOrca,
      openFolder
    })
  })

  it('selects the agent’s pane, then brings Orca forward, and types nothing', async () => {
    expect(await interactions.focus('claude:s1')).toEqual({ success: true, target: 'pane' })

    expect(orca.handleFor).toHaveBeenCalledWith('tab1:leaf1')
    expect(orca.focus).toHaveBeenCalledWith('term_a')
    const [resolved, switched, raised] = [orca.handleFor, orca.focus, raiseOrca].map(
      (step) => step.mock.invocationCallOrder[0]
    )
    expect(resolved).toBeLessThan(switched)
    expect(switched).toBeLessThan(raised)
    expect(openFolder).not.toHaveBeenCalled()
    expectNothingTyped()
  })

  it.each([
    ['claude', 'claude'],
    ['claude', 'claude-agent-teams'],
    ['codex', 'codex']
  ] as const)('focuses a %s session whose pane runs %s', async (provider, agent) => {
    snapshot.sessions = [session({ provider })]
    orca.handleFor.mockResolvedValueOnce(pane({ agent }))

    expect(await interactions.focus('claude:s1')).toEqual({ success: true, target: 'pane' })
  })

  it.each([
    ['the pane is gone', () => orca.handleFor.mockResolvedValueOnce(null), 'terminal-not-found'],
    [
      'the pane serves another folder',
      () => orca.handleFor.mockResolvedValueOnce(pane({ worktreePath: '/other/repo' })),
      'terminal-not-found'
    ],
    [
      'the agent exited and left a shell',
      () => orca.handleFor.mockResolvedValueOnce(pane({ agent: null })),
      'terminal-not-found'
    ],
    [
      'another provider’s agent runs there',
      () => orca.handleFor.mockResolvedValueOnce(pane({ agent: 'codex' })),
      'terminal-not-found'
    ],
    ['the process is gone', () => processStart.mockResolvedValueOnce(null), 'unknown-session'],
    ['the pid was reused', () => processStart.mockResolvedValueOnce(999), 'unknown-session'],
    [
      'Orca does not answer',
      () => orca.handleFor.mockRejectedValueOnce(new Error('ECONNREFUSED')),
      'orca-unavailable'
    ]
  ])('switches no pane and only brings Orca forward when %s', async (_case, arrange, reason) => {
    arrange()

    expect(await interactions.focus('claude:s1')).toEqual({
      success: false,
      reason,
      target: 'app'
    })
    expect(orca.focus).not.toHaveBeenCalled()
    expect(raiseOrca).toHaveBeenCalledOnce()
    expect(openFolder).not.toHaveBeenCalled()
    expectNothingTyped()
  })

  it('lands on the app alone when Orca refuses or ignores the switch', async () => {
    const appOnly = { success: false, reason: 'orca-unavailable', target: 'app' }

    orca.focus.mockRejectedValueOnce(new Error('terminal_exited'))
    expect(await interactions.focus('claude:s1')).toEqual(appOnly)
    orca.focus.mockResolvedValueOnce(false)
    expect(await interactions.focus('claude:s1')).toEqual(appOnly)
    expect(raiseOrca).toHaveBeenCalledTimes(2)
  })

  it('never opens another terminal for an Orca agent whose pane belongs to its parent', async () => {
    snapshot.sessions = [session({ orcaPaneKey: null })]

    expect(await interactions.focus('claude:s1')).toEqual({
      success: false,
      reason: 'terminal-not-found',
      target: 'app'
    })
    expect(orca.handleFor).not.toHaveBeenCalled()
    expect(openFolder).not.toHaveBeenCalled()
  })

  it('claims no landing place when Orca cannot be brought forward', async () => {
    raiseOrca.mockResolvedValue(false)

    expect(await interactions.focus('claude:s1')).toEqual({
      success: false,
      reason: 'orca-unavailable'
    })
    orca.handleFor.mockResolvedValueOnce(null)
    expect(await interactions.focus('claude:s1')).toEqual({
      success: false,
      reason: 'terminal-not-found'
    })
  })

  it('opens the folder in the session’s own terminal outside Orca', async () => {
    snapshot.sessions = [session({ host: 'terminal', orcaPaneKey: null, pid: 4242 })]

    expect(await interactions.focus('claude:s1')).toEqual({ success: true, target: 'terminal' })
    expect(openFolder).toHaveBeenCalledWith('/repo/app', 4242)
    expect(raiseOrca).not.toHaveBeenCalled()
    expect(orca.handleFor).not.toHaveBeenCalled()

    openFolder.mockResolvedValueOnce({ success: false })
    expect(await interactions.focus('claude:s1')).toEqual({ success: false })
  })

  it.each(['claude:missing', 'claude:s1#nobody', 'claude:missing#lena', '', '#'])(
    'runs nothing for the unknown agent %j',
    async (agentKey) => {
      snapshot.sessions = [session({ subagents: [teammate] })]

      expect(await interactions.focus(agentKey)).toEqual({
        success: false,
        reason: 'unknown-session'
      })
      for (const step of [processStart, orca.handleFor, orca.focus, raiseOrca, openFolder]) {
        expect(step).not.toHaveBeenCalled()
      }
    }
  )

  it('focuses a teammate’s own pane, proven by its own process, not the lead’s', async () => {
    snapshot.sessions = [session({ subagents: [teammate] })]
    processStart.mockResolvedValue(5)
    orca.handleFor.mockResolvedValue(pane({ handle: 'term_lena' }))

    expect(await interactions.focus('claude:s1#lena')).toEqual({ success: true, target: 'pane' })
    expect(processStart).toHaveBeenCalledWith(77)
    expect(orca.handleFor).toHaveBeenCalledWith('tab1:leaf7')
    expect(orca.focus).toHaveBeenCalledWith('term_lena')
  })

  it.each([
    ['whose process changed', teammate, 1, 'unknown-session'],
    ['with no pane key', { ...teammate, orcaPaneKey: null }, 5, 'terminal-not-found'],
    ['with no pid', { ...teammate, pid: null }, 5, 'unknown-session'],
    ['with no start time', { ...teammate, startedAtMs: undefined }, 5, 'unknown-session']
  ])(
    'only brings Orca forward for a teammate %s, never the lead’s pane',
    async (_case, member, liveStart, reason) => {
      snapshot.sessions = [session({ subagents: [member] })]
      processStart.mockResolvedValue(liveStart)

      expect(await interactions.focus('claude:s1#lena')).toEqual({
        success: false,
        reason,
        target: 'app'
      })
      expect(orca.focus).not.toHaveBeenCalled()
    }
  )

  it('opens the lead’s folder for a teammate outside Orca', async () => {
    snapshot.sessions = [
      session({
        host: 'terminal',
        orcaPaneKey: null,
        subagents: [{ ...teammate, orcaPaneKey: null }]
      })
    ]

    expect(await interactions.focus('claude:s1#lena')).toEqual({
      success: true,
      target: 'terminal'
    })
    expect(openFolder).toHaveBeenCalledWith('/repo/app', 77)
  })

  it('focuses the parent’s pane for a subagent that runs inside its parent', async () => {
    snapshot.sessions = [
      session({ subagents: [{ id: 'sub1', type: 'Explore', activity: 'reading' }] })
    ]

    expect(await interactions.focus('claude:s1#sub1')).toEqual({ success: true, target: 'pane' })
    expect(processStart).toHaveBeenCalledWith(1)
    expect(orca.handleFor).toHaveBeenCalledWith('tab1:leaf1')
  })

  it('ends on the second agent when two are clicked in quick succession', async () => {
    snapshot.sessions = [
      session(),
      session({ key: 'claude:s2', sessionId: 's2', orcaPaneKey: 'tab2:leaf2' })
    ]
    let releaseFirst = (): void => {}
    orca.handleFor.mockImplementation(async (paneKey: string) => {
      if (paneKey === 'tab1:leaf1') await new Promise<void>((done) => (releaseFirst = done))
      return pane({ handle: paneKey === 'tab1:leaf1' ? 'term_first' : 'term_second' })
    })

    const first = interactions.focus('claude:s1')
    const second = interactions.focus('claude:s2')
    await vi.waitFor(() => expect(orca.handleFor).toHaveBeenCalled())
    releaseFirst()
    await Promise.all([first, second])

    expect(orca.focus.mock.calls).toEqual([['term_first'], ['term_second']])
  })
})
