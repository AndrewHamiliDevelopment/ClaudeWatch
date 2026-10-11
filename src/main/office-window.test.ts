import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'
import { OfficeWindowController, opensOfficeOnStart, type OfficeWindowLike } from './office-window'
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
  projectRoot: '/repo/app',
  companyKey: 'c_test',
  companyLabel: 'Test Co',
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
      }
    })
  })

  it('creates the window once and focuses it on a second open', () => {
    controller.open()
    controller.open()

    expect(windows).toHaveLength(1)
    expect(windows[0].focus).toHaveBeenCalledOnce()
  })

  it('forwards feed messages to the window while it is open', () => {
    controller.open()
    feedListener?.({ type: 'resync' })
    expect(windows[0].webContents.send).toHaveBeenCalledWith('office:feed', { type: 'resync' })
  })

  it('stops forwarding when the window closes, and opens a new one next time', () => {
    controller.open()
    windows[0].close()

    expect(feedListener).toBeNull()
    controller.open()
    expect(windows).toHaveLength(2)
  })

  it('leaves the bridge alone: the dashboard reads it with the Office closed', () => {
    controller.open()
    windows[0].close()

    expect(host.start).not.toHaveBeenCalled()
    expect(host.stop).not.toHaveBeenCalled()
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
})

describe('opensOfficeOnStart', () => {
  it('opens for the setting or the --open-office switch, and stays in the tray otherwise', () => {
    expect(opensOfficeOnStart({ openOfficeOnLaunch: true }, ['electron', 'main.js'])).toBe(true)
    expect(opensOfficeOnStart({ openOfficeOnLaunch: false }, ['app', '--open-office'])).toBe(true)
    expect(opensOfficeOnStart({ openOfficeOnLaunch: false }, ['electron', 'main.js'])).toBe(false)
    // A hand-edited file can hold a string; only a real true counts.
    const edited = { openOfficeOnLaunch: 'false' as unknown as boolean }
    expect(opensOfficeOnStart(edited, ['electron', 'main.js'])).toBe(false)
  })
})
