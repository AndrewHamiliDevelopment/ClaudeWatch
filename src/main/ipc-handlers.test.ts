import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mocks are available in factory functions
const { mockHandle, mockQuit } = vi.hoisted(() => {
  const mockHandle = vi.fn()
  const mockQuit = vi.fn()
  return { mockHandle, mockQuit }
})

vi.mock('electron', () => ({
  ipcMain: {
    handle: mockHandle
  },
  app: {
    quit: mockQuit
  },
  BrowserWindow: vi.fn()
}))

import { setupIpcHandlers, forwardUpdatesToRenderer } from './ipc-handlers'
import type { SessionTracker } from './session-tracker'
import type { SettingsStore } from './store'

function makeTracker(overrides: Partial<SessionTracker> = {}): SessionTracker {
  return {
    getInstances: vi.fn().mockReturnValue([{ pid: 1 }, { pid: 2 }]),
    getStats: vi.fn().mockReturnValue({ total: 2, active: 1, idle: 1 }),
    getHistory: vi.fn().mockReturnValue([]),
    clearHistory: vi.fn(),
    on: vi.fn(),
    ...overrides
  } as unknown as SessionTracker
}

function makeStore(overrides: Partial<SettingsStore> = {}): SettingsStore {
  return {
    getSettings: vi.fn().mockReturnValue({ pollingIntervalMs: 3000 }),
    setSettings: vi.fn().mockReturnValue({ pollingIntervalMs: 5000 }),
    getHistory: vi.fn().mockReturnValue([{ pid: 10 }]),
    clearHistory: vi.fn(),
    ...overrides
  } as unknown as SettingsStore
}

describe('setupIpcHandlers', () => {
  let tracker: ReturnType<typeof makeTracker>
  let store: ReturnType<typeof makeStore>
  let onOpenDashboard: ReturnType<typeof vi.fn>
  let handlers: Record<string, (...args: unknown[]) => unknown>

  beforeEach(() => {
    vi.clearAllMocks()
    handlers = {}
    mockHandle.mockImplementation((channel: string, handler: (...args: unknown[]) => unknown) => {
      handlers[channel] = handler
    })

    tracker = makeTracker()
    store = makeStore()
    onOpenDashboard = vi.fn()
    setupIpcHandlers({ tracker, store, onOpenDashboard })
  })

  describe('handler registration', () => {
    it('should register all expected IPC handlers', () => {
      const expectedChannels = [
        'instances:get',
        'settings:get',
        'settings:set',
        'history:get',
        'history:clear',
        'app:open-dashboard',
        'app:quit',
        'terminal:open'
      ]

      for (const channel of expectedChannels) {
        expect(handlers[channel], `handler for "${channel}" should be registered`).toBeDefined()
      }

      expect(mockHandle).toHaveBeenCalledTimes(expectedChannels.length)
    })
  })

  describe('instances:get', () => {
    it('should return instances and stats from tracker', () => {
      const result = handlers['instances:get']()

      expect(tracker.getInstances).toHaveBeenCalledOnce()
      expect(tracker.getStats).toHaveBeenCalledOnce()
      expect(result).toEqual({
        instances: [{ pid: 1 }, { pid: 2 }],
        stats: { total: 2, active: 1, idle: 1 }
      })
    })
  })

  describe('settings:get', () => {
    it('should return settings from store', () => {
      const result = handlers['settings:get']()

      expect(store.getSettings).toHaveBeenCalledOnce()
      expect(result).toEqual({ pollingIntervalMs: 3000 })
    })
  })

  describe('settings:set', () => {
    it('should call store.setSettings with data and return updated settings', () => {
      const updatedSettings = { pollingIntervalMs: 5000, theme: 'light' }
      ;(store.getSettings as ReturnType<typeof vi.fn>).mockReturnValue(updatedSettings)

      const fakeEvent = {} as Electron.IpcMainInvokeEvent
      const result = handlers['settings:set'](fakeEvent, { pollingIntervalMs: 5000 })

      expect(store.setSettings).toHaveBeenCalledWith({ pollingIntervalMs: 5000 })
      expect(store.getSettings).toHaveBeenCalled()
      expect(result).toEqual(updatedSettings)
    })
  })

  describe('history:get', () => {
    it('should return history from store', () => {
      const result = handlers['history:get']()

      expect(store.getHistory).toHaveBeenCalledOnce()
      expect(result).toEqual([{ pid: 10 }])
    })
  })

  describe('history:clear', () => {
    it('should call store.clearHistory and return success', () => {
      const result = handlers['history:clear']()

      expect(store.clearHistory).toHaveBeenCalledOnce()
      expect(result).toEqual({ success: true })
    })
  })

  describe('app:open-dashboard', () => {
    it('should call onOpenDashboard callback and return success', () => {
      const result = handlers['app:open-dashboard']()

      expect(onOpenDashboard).toHaveBeenCalledOnce()
      expect(result).toEqual({ success: true })
    })
  })

  describe('app:quit', () => {
    it('should call app.quit', () => {
      handlers['app:quit']()

      expect(mockQuit).toHaveBeenCalledOnce()
    })
  })
})

describe('forwardUpdatesToRenderer', () => {
  it('should register an update listener on the tracker', () => {
    const tracker = makeTracker()
    const getWindow = vi.fn()

    forwardUpdatesToRenderer(tracker, getWindow)

    expect(tracker.on).toHaveBeenCalledWith('update', expect.any(Function))
  })

  it('should send updates to window webContents when window exists and is not destroyed', () => {
    const tracker = makeTracker()
    let updateCallback: (data: unknown) => void = () => {}
    ;(tracker.on as ReturnType<typeof vi.fn>).mockImplementation(
      (_event: string, cb: (data: unknown) => void) => {
        updateCallback = cb
      }
    )

    const mockSend = vi.fn()
    const mockWindow = {
      isDestroyed: vi.fn().mockReturnValue(false),
      webContents: { send: mockSend }
    }
    const getWindow = vi.fn().mockReturnValue(mockWindow)

    forwardUpdatesToRenderer(tracker, getWindow)

    const updateData = { instances: [{ pid: 1 }], stats: { total: 1 } }
    updateCallback(updateData)

    expect(getWindow).toHaveBeenCalled()
    expect(mockWindow.isDestroyed).toHaveBeenCalled()
    expect(mockSend).toHaveBeenCalledWith('instances:update', updateData)
  })

  it('should not send updates when getWindow returns null', () => {
    const tracker = makeTracker()
    let updateCallback: (data: unknown) => void = () => {}
    ;(tracker.on as ReturnType<typeof vi.fn>).mockImplementation(
      (_event: string, cb: (data: unknown) => void) => {
        updateCallback = cb
      }
    )

    const getWindow = vi.fn().mockReturnValue(null)

    forwardUpdatesToRenderer(tracker, getWindow)
    updateCallback({ some: 'data' })

    expect(getWindow).toHaveBeenCalled()
    // Should not throw
  })

  it('should not send updates when window is destroyed', () => {
    const tracker = makeTracker()
    let updateCallback: (data: unknown) => void = () => {}
    ;(tracker.on as ReturnType<typeof vi.fn>).mockImplementation(
      (_event: string, cb: (data: unknown) => void) => {
        updateCallback = cb
      }
    )

    const mockSend = vi.fn()
    const mockWindow = {
      isDestroyed: vi.fn().mockReturnValue(true),
      webContents: { send: mockSend }
    }
    const getWindow = vi.fn().mockReturnValue(mockWindow)

    forwardUpdatesToRenderer(tracker, getWindow)
    updateCallback({ some: 'data' })

    expect(getWindow).toHaveBeenCalled()
    expect(mockWindow.isDestroyed).toHaveBeenCalled()
    expect(mockSend).not.toHaveBeenCalled()
  })
})
