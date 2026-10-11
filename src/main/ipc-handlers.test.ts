import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS } from '../renderer/lib/types'

const { handle, app, openExternal } = vi.hoisted(() => ({
  handle: vi.fn(),
  app: { isQuitting: false, isPackaged: false, quit: vi.fn(), setLoginItemSettings: vi.fn() },
  openExternal: vi.fn()
}))
vi.mock('electron', () => ({ ipcMain: { handle }, app, shell: { openExternal } }))
vi.mock('./terminal-opener', () => ({ openTerminal: vi.fn(() => ({ success: true })) }))
import { openTerminal } from './terminal-opener'
import { forwardUpdatesToRenderer, setupIpcHandlers } from './ipc-handlers'
import { join } from 'path'
import { pathToFileURL } from 'url'

const APP_PAGE = pathToFileURL(join(__dirname, '../renderer/index.html')).href
const appEvent = { senderFrame: { parent: null, url: APP_PAGE } }
const stats = { total: 2, active: 1, idle: 1, stale: 0, exited: 0, recentlyCompleted: 0 }
const usage = {
  totalInputTokens: 1,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheCreationTokens: 0,
  totalCostUSD: 0,
  modelUsage: [],
  dataAvailable: true,
  lastUpdated: null,
  weeklyTokens: 1,
  weeklyTokenTarget: 100_000
}
const tracker = {
  getInstances: vi.fn(() => []),
  getStats: vi.fn(() => stats),
  setStaleThreshold: vi.fn(),
  setCooldownSeconds: vi.fn(),
  on: vi.fn()
}
const store = {
  getSettings: vi.fn(() => structuredClone(DEFAULT_SETTINGS)),
  setSettings: vi.fn(),
  getHistory: vi.fn(() => []),
  clearHistory: vi.fn()
}
const usageReader = {
  getLastData: vi.fn(() => null),
  read: vi.fn(async () => usage),
  setWeeklyTokenTarget: vi.fn()
}
const promoChecker = { getLastData: vi.fn(() => null) }
const rateLimitReader = {
  getLastData: vi.fn(() => null),
  isStatuslineConfigured: vi.fn(async () => true),
  setupStatusline: vi.fn(async () => true)
}
const updater = { checkForUpdates: vi.fn(), downloadUpdate: vi.fn(), quitAndInstall: vi.fn() }
const notifications = { isSupported: vi.fn(() => true), sendTest: vi.fn(() => ({ sent: true })) }
const onOpenDashboard = vi.fn()
let handlers: Record<string, (...args: unknown[]) => unknown>

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
  app.isQuitting = false
  handlers = {}
  handle.mockImplementation((channel: string, listener: (...args: unknown[]) => unknown) => {
    handlers[channel] = listener
  })
  setupIpcHandlers({
    tracker,
    store,
    updater,
    usageReader,
    promoChecker,
    rateLimitReader,
    notifications,
    onOpenDashboard
  })
})

describe('IPC authorization', () => {
  it('registers all 25 handlers', () => expect(Object.keys(handlers)).toHaveLength(25))
  it.each([
    null,
    { senderFrame: null },
    { senderFrame: { parent: {}, url: APP_PAGE } },
    { senderFrame: { parent: null, url: 'file:///tmp/dropped.html' } },
    ...['https://example.com', 'about:blank', 'data:text/html,x', 'invalid'].map((url) => ({
      senderFrame: { parent: null, url }
    }))
  ])('rejects untrusted events before every handler: %j', (event) => {
    for (const listener of Object.values(handlers)) {
      expect(() => listener(event)).toThrow('Untrusted IPC sender')
    }
  })
  it('accepts only the dev server origin', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
    expect(
      handlers['instances:get']({
        senderFrame: {
          parent: null,
          url: 'http://localhost:5173/#popover'
        }
      })
    ).toBeDefined()
    expect(() =>
      handlers['instances:get']({
        senderFrame: {
          parent: null,
          url: 'http://localhost:5174'
        }
      })
    ).toThrow('Untrusted IPC sender')
  })
})

it.each([
  ['instances:get', { instances: [], stats }],
  ['settings:get', DEFAULT_SETTINGS],
  ['history:get', []],
  ['usage:get', null],
  ['usage:refresh', usage],
  ['promo:get', null],
  ['ratelimits:get', null],
  ['ratelimits:statusline-status', true],
  ['notifications:check-permission', { supported: true }],
  ['notifications:send-test', { sent: true }],
  ['popover:get-pinned', false],
  ['popover:close', { success: false }],
  ['popover:set-pinned', { success: false }]
])('%s returns its result for a trusted sender', async (channel, expected) => {
  expect(await handlers[channel](appEvent)).toEqual(expected)
})

it('filters unknown settings keys, including nested keys', () => {
  handlers['settings:set'](appEvent, {
    theme: 'dark',
    injected: true,
    notifications: { sound: true, injected: true }
  })
  expect(store.setSettings).toHaveBeenCalledWith({ theme: 'dark', notifications: { sound: true } })
})
it('retains settings propagation', () => {
  handlers['settings:set'](appEvent, {
    weeklyTokenTarget: 100_000,
    launchAtLogin: true,
    staleThresholdMinutes: 10,
    notifications: { cooldownSeconds: 30 }
  })
  expect(usageReader.setWeeklyTokenTarget).toHaveBeenCalledWith(DEFAULT_SETTINGS.weeklyTokenTarget)
  expect(app.setLoginItemSettings).toHaveBeenCalledWith({ openAtLogin: true })
  expect(tracker.setStaleThreshold).toHaveBeenCalledWith(DEFAULT_SETTINGS.staleThresholdMinutes)
  expect(tracker.setCooldownSeconds).toHaveBeenCalledWith(
    DEFAULT_SETTINGS.notifications.cooldownSeconds
  )
})
it.each(['bogus', null, 42, {}, 'toString'])('rejects terminal type %j', (type) => {
  expect(handlers['terminal:open'](appEvent, '/project', type)).toEqual({ success: false })
  expect(openTerminal).not.toHaveBeenCalled()
})
it.each(['', 'relative/path', undefined, null, 42, {}])('rejects path %j', (path) => {
  expect(handlers['terminal:open'](appEvent, path)).toEqual({ success: false })
  expect(openTerminal).not.toHaveBeenCalled()
})
it.each([
  undefined,
  'terminal-app',
  'iterm2',
  'warp',
  'alacritty',
  'kitty',
  'wezterm',
  'hyper',
  'ghostty',
  'vscode',
  'cursor',
  'tmux',
  'screen',
  'unknown'
])('accepts terminal %s', (type) => {
  expect(handlers['terminal:open'](appEvent, '/project', type)).toEqual({ success: true })
  expect(openTerminal).toHaveBeenCalledWith('/project', type)
})
it.each([
  ['history:clear', store.clearHistory],
  ['app:open-dashboard', onOpenDashboard],
  ['app:quit', app.quit],
  ['updater:check', updater.checkForUpdates],
  ['updater:download', updater.downloadUpdate],
  ['updater:install', updater.quitAndInstall]
])('%s calls its dependency', (channel, callback) => {
  if (channel === 'app:quit' || channel === 'updater:install') {
    callback.mockImplementationOnce(() => expect(app.isQuitting).toBe(true))
  }
  handlers[channel](appEvent)
  expect(callback).toHaveBeenCalledOnce()
  if (channel === 'app:quit' || channel === 'updater:install') expect(app.isQuitting).toBe(true)
})
it('does not begin quitting without an updater', () => {
  setupIpcHandlers({ tracker, store, onOpenDashboard })
  handlers['updater:install'](appEvent)
  expect(app.isQuitting).toBe(false)
  expect(handlers['ratelimits:get'](appEvent)).toBeNull()
})
it('opens only the fixed notification settings destination', () => {
  handlers['notifications:open-settings'](appEvent)
  expect(openExternal).toHaveBeenCalledWith(
    'x-apple.systempreferences:com.apple.preference.notifications'
  )
})
it.each(['mute', 'unmute'])('updates the %s project list', (action) => {
  handlers[`notifications:${action}-project`](appEvent, '/project')
  expect(store.setSettings).toHaveBeenCalledWith({
    notifications: {
      ...DEFAULT_SETTINGS.notifications,
      mutedProjects: action === 'mute' ? ['/project'] : []
    }
  })
})
it.each([false, true, null])('forwards updates only to live windows: %s', (destroyed) => {
  const send = vi.fn()
  const window = destroyed === null ? null : { isDestroyed: () => destroyed, webContents: { send } }
  forwardUpdatesToRenderer(tracker, vi.fn(() => window) as () => Electron.BrowserWindow | null)
  const listener = tracker.on.mock.calls.at(-1)?.[1]
  listener({ instances: [], stats: { total: 2 } })
  expect(send).toHaveBeenCalledTimes(destroyed === false ? 1 : 0)
})
