import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import { OfficeWindowController, type OfficeWindowLike } from './office-window'
import type { FeedMessage, OfficeSnapshot, SessionRef } from '../shared/office/types'

class FakeWindow extends EventEmitter implements OfficeWindowLike {
  webContents = { send: vi.fn() }
  focus = vi.fn()
  destroyed = false
  isDestroyed = (): boolean => this.destroyed
  close(): void {
    this.destroyed = true
    this.emit('closed')
  }
}

const session = (overrides: Partial<SessionRef>): SessionRef => ({
  key: 'claude:s1',
  provider: 'claude',
  sessionId: 's1',
  pid: 4242,
  name: 'app',
  cwd: '/Users/dev/app',
  projectKey: 'p_1',
  projectLabel: 'app',
  worktree: null,
  host: 'terminal',
  orcaPaneKey: null,
  activity: 'idle',
  attention: 'none',
  currentTool: null,
  subagents: [],
  startedAtMs: 1,
  updatedAtMs: 1,
  ...overrides
})

describe('OfficeWindowController', () => {
  let windows: FakeWindow[]
  let feedListener: ((message: FeedMessage) => void) | null
  let snapshot: OfficeSnapshot | null
  const host = {
    start: vi.fn(),
    stop: vi.fn(),
    snapshot: () => snapshot,
    onMessage: (listener: (message: FeedMessage) => void) => {
      feedListener = listener
      return () => {
        feedListener = null
      }
    }
  }
  const openTerminal = vi.fn().mockResolvedValue({ success: true })
  const resolveTerminalType = vi.fn().mockResolvedValue('iterm2')
  const activateOrca = vi.fn().mockResolvedValue({ success: true })
  let controller: OfficeWindowController

  beforeEach(() => {
    vi.clearAllMocks()
    windows = []
    feedListener = null
    snapshot = null
    controller = new OfficeWindowController({
      host,
      createWindow: () => {
        const window = new FakeWindow()
        windows.push(window)
        return window
      },
      openTerminal,
      resolveTerminalType,
      activateOrca
    })
  })

  it('creates the window once, starts the bridge and focuses on a second open', () => {
    controller.open()
    controller.open()

    expect(windows).toHaveLength(1)
    expect(host.start).toHaveBeenCalledOnce()
    expect(windows[0].focus).toHaveBeenCalledOnce()
  })

  it('forwards feed messages to the window while it is open', () => {
    controller.open()
    feedListener?.({ type: 'resync' })
    expect(windows[0].webContents.send).toHaveBeenCalledWith('office:feed', { type: 'resync' })
  })

  it('stops the bridge and stops forwarding when the window closes', () => {
    controller.open()
    windows[0].close()

    expect(host.stop).toHaveBeenCalledOnce()
    expect(feedListener).toBeNull()
    controller.open()
    expect(windows).toHaveLength(2)
  })

  it('answers ready with a hello built from the current snapshot', () => {
    snapshot = { rev: 7, generatedAtMs: 1, sessions: [session({})], sources: [] }
    controller.open()
    controller.ready()

    expect(windows[0].webContents.send).toHaveBeenCalledWith('office:feed', {
      type: 'hello',
      v: 1,
      snapshot
    })
  })

  it('jumps to a terminal session in its own terminal app at its folder', async () => {
    snapshot = { rev: 1, generatedAtMs: 1, sessions: [session({})], sources: [] }

    expect(await controller.jump('claude:s1')).toEqual({ success: true })
    expect(resolveTerminalType).toHaveBeenCalledWith(4242)
    expect(openTerminal).toHaveBeenCalledWith('/Users/dev/app', 'iterm2')
  })

  it('brings Orca forward for a session that runs inside Orca', async () => {
    snapshot = {
      rev: 1,
      generatedAtMs: 1,
      sessions: [session({ host: 'orca', orcaPaneKey: 'tab:leaf' })],
      sources: []
    }

    await controller.jump('claude:s1')
    expect(activateOrca).toHaveBeenCalledOnce()
    expect(openTerminal).not.toHaveBeenCalled()
  })

  it('refuses to jump to an unknown session', async () => {
    snapshot = { rev: 1, generatedAtMs: 1, sessions: [], sources: [] }
    expect(await controller.jump('claude:missing')).toEqual({ success: false })
    expect(openTerminal).not.toHaveBeenCalled()
  })
})
