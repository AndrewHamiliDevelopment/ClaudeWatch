import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PaneFocus } from './pane-focus'
import { OfficeInteractions } from './office-interactions'
import type { PaneTerminal } from './orca-terminals'

const pane = (overrides: Partial<PaneTerminal> = {}): PaneTerminal => ({
  handle: 'term_a',
  worktreePath: '/repo/app',
  agent: 'claude',
  incarnationId: 'inc_1',
  ...overrides
})

describe('PaneFocus', () => {
  const orca = {
    handleFor: vi.fn(),
    sendPrompt: vi.fn(),
    sendKey: vi.fn(),
    screen: vi.fn(),
    create: vi.fn(),
    focus: vi.fn()
  }
  const processStart = vi.fn()
  const paneKeyOf = vi.fn()
  const raiseOrca = vi.fn()
  const openFolder = vi.fn()
  let tracked: { pid: number; projectPath: string }[]
  let paneFocus: PaneFocus

  const expectNothingRun = (): void => {
    for (const step of [processStart, paneKeyOf, orca.handleFor, orca.focus, raiseOrca, openFolder])
      expect(step).not.toHaveBeenCalled()
  }

  beforeEach(() => {
    vi.resetAllMocks()
    orca.handleFor.mockResolvedValue(pane())
    orca.focus.mockResolvedValue(true)
    processStart.mockResolvedValue(1_700_000_000_000)
    paneKeyOf.mockResolvedValue('tab1:leaf1')
    raiseOrca.mockResolvedValue(true)
    openFolder.mockResolvedValue({ success: true })
    tracked = [{ pid: 4242, projectPath: '/repo/app' }]
    // The real routine behind it, so the order and the ownership checks are the shipped ones.
    const interactions = new OfficeInteractions({
      snapshot: () => null,
      orca,
      openTerminalRunning: vi.fn(),
      processStart,
      raiseOrca,
      openFolder
    })
    paneFocus = new PaneFocus({
      instances: () => tracked,
      processStart,
      paneKeyOf,
      focusProcess: (owner) => interactions.focusProcess(owner)
    })
  })

  it('finds the tracked pid’s pane, checks it, switches to it, then raises Orca', async () => {
    expect(await paneFocus.focus(4242)).toEqual({ success: true, target: 'pane' })

    expect(paneKeyOf).toHaveBeenCalledWith(4242)
    expect(orca.handleFor).toHaveBeenCalledWith('tab1:leaf1')
    expect(orca.focus).toHaveBeenCalledWith('term_a')
    const steps = [paneKeyOf, orca.handleFor, orca.focus, raiseOrca].map(
      (step) => step.mock.invocationCallOrder[0]
    )
    expect(steps).toEqual([...steps].sort((a, b) => a - b))
    expect(openFolder).not.toHaveBeenCalled()
    expect(orca.sendPrompt).not.toHaveBeenCalled()
    expect(orca.sendKey).not.toHaveBeenCalled()
  })

  it.each([4243, -4242, 0, 4242.5, '4242', null, undefined, {}, [4242], Number.NaN])(
    'runs nothing for %j, which the tracker does not list',
    async (pid) => {
      expect(await paneFocus.focus(pid)).toEqual({ success: false, reason: 'unknown-session' })
      expectNothingRun()
    }
  )

  it('runs nothing for a tracked process whose folder is unknown', async () => {
    tracked = [{ pid: 4242, projectPath: '' }]
    expect(await paneFocus.focus(4242)).toEqual({ success: false, reason: 'unknown-session' })
    expectNothingRun()
  })

  it('does nothing more once the process has exited', async () => {
    processStart.mockResolvedValue(null)
    expect(await paneFocus.focus(4242)).toEqual({ success: false, reason: 'unknown-session' })
    expect(paneKeyOf).not.toHaveBeenCalled()
    expect(raiseOrca).not.toHaveBeenCalled()
  })

  it('does not trust a pane key read while the pid changed hands', async () => {
    processStart.mockResolvedValueOnce(1_700_000_000_000).mockResolvedValueOnce(1_700_000_009_000)

    expect(await paneFocus.focus(4242)).toEqual({
      success: false,
      reason: 'unknown-session',
      target: 'app'
    })
    expect(orca.focus).not.toHaveBeenCalled()
  })

  it('opens the tracker’s folder, in the terminal hosting the pid, outside Orca', async () => {
    paneKeyOf.mockResolvedValue(null)

    expect(await paneFocus.focus(4242)).toEqual({ success: true, target: 'terminal' })
    expect(openFolder).toHaveBeenCalledWith('/repo/app', 4242)
    expect(orca.handleFor).not.toHaveBeenCalled()
    expect(raiseOrca).not.toHaveBeenCalled()
  })

  it.each([
    ['serves another folder', pane({ worktreePath: '/other/repo' })],
    ['runs no Claude agent', pane({ agent: null })],
    ['is gone', null]
  ])('only raises Orca, and opens no other terminal, when the pane %s', async (_case, found) => {
    orca.handleFor.mockResolvedValue(found)

    expect(await paneFocus.focus(4242)).toEqual({
      success: false,
      reason: 'terminal-not-found',
      target: 'app'
    })
    expect(orca.focus).not.toHaveBeenCalled()
    expect(raiseOrca).toHaveBeenCalledOnce()
    expect(openFolder).not.toHaveBeenCalled()
  })

  it('accepts a pane whose worktree holds the tracked folder', async () => {
    tracked = [{ pid: 4242, projectPath: '/repo/app/packages/web' }]
    expect(await paneFocus.focus(4242)).toEqual({ success: true, target: 'pane' })
  })
})
