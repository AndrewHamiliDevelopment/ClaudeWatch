import { beforeEach, describe, expect, it, vi } from 'vitest'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { DEFAULT_SETTINGS } from '../renderer/lib/types'
import type { AccountsState, AliasResult } from '../shared/accounts'

const { handle } = vi.hoisted(() => ({ handle: vi.fn() }))
vi.mock('electron', () => ({
  ipcMain: { handle },
  app: { isPackaged: false, setLoginItemSettings: vi.fn() },
  shell: { openExternal: vi.fn() }
}))
vi.mock('./terminal-opener', () => ({ openTerminal: vi.fn() }))
import { setupIpcHandlers } from './ipc-handlers'

const pageEvent = (page: string): unknown => ({
  senderFrame: { parent: null, url: pathToFileURL(join(__dirname, '../renderer', page)).href }
})
const dashboard = pageEvent('index.html')
const watching: AccountsState = {
  status: 'on',
  generatedAtMs: 2,
  trackingSinceMs: 1,
  accounts: [],
  unattributed: {
    usage: {
      today: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      last7Days: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
      sinceTracking: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
    },
    projects: []
  }
}
const accounts = {
  dashboardState: vi.fn(async () => watching),
  setAlias: vi.fn((): AliasResult => ({ success: true })),
  setWatching: vi.fn()
}
const tracker = {
  getInstances: vi.fn(() => []),
  getStats: vi.fn(),
  setStaleThreshold: vi.fn(),
  setCooldownSeconds: vi.fn(),
  setCpuIdleThreshold: vi.fn(),
  setMaxHistoryEntries: vi.fn(),
  start: vi.fn()
}
let settings = structuredClone(DEFAULT_SETTINGS)
const store = {
  getSettings: vi.fn(() => settings),
  setSettings: vi.fn((partial: Partial<typeof settings>) => {
    settings = { ...settings, ...partial }
    return settings
  }),
  getHistory: vi.fn(() => []),
  clearHistory: vi.fn()
}
let handlers: Record<string, (...args: unknown[]) => unknown>

function register(withAccounts = true): void {
  handlers = {}
  handle.mockImplementation((channel: string, listener: (...args: unknown[]) => unknown) => {
    handlers[channel] = listener
  })
  setupIpcHandlers({
    tracker,
    store,
    onOpenDashboard: vi.fn(),
    onOpenOffice: vi.fn(),
    focusSession: vi.fn(),
    getOfficeSnapshot: vi.fn(() => null),
    ...(withAccounts && { accounts })
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  settings = structuredClone(DEFAULT_SETTINGS)
  register()
})

describe('accounts over IPC', () => {
  it('gives the dashboard every account with its totals', async () => {
    expect(await handlers['accounts:get'](dashboard)).toEqual(watching)
  })

  it('reports accounts as off when the app runs without a ledger', async () => {
    register(false)
    expect(await handlers['accounts:get'](dashboard)).toEqual({ status: 'off' })
    expect(await handlers['accounts:set-alias'](dashboard, 'claude:a', 'Work')).toEqual({
      success: false,
      reason: 'off'
    })
  })

  it('hands a new name to the ledger untouched, which is where it is checked', async () => {
    accounts.setAlias.mockReturnValueOnce({ success: false, reason: 'invalid-alias' })
    expect(await handlers['accounts:set-alias'](dashboard, 'claude:a', { not: 'text' })).toEqual({
      success: false,
      reason: 'invalid-alias'
    })
    expect(accounts.setAlias).toHaveBeenCalledExactlyOnceWith('claude:a', { not: 'text' })
  })

  it.each(['accounts:get', 'accounts:set-alias'])(
    '%s answers the dashboard only: emails never reach the Office page',
    (channel) => {
      for (const event of [pageEvent('office.html'), { senderFrame: null }, null]) {
        expect(() => handlers[channel](event, 'claude:a', 'Work')).toThrow('Untrusted IPC sender')
      }
      expect(accounts.dashboardState).not.toHaveBeenCalled()
      expect(accounts.setAlias).not.toHaveBeenCalled()
    }
  )
})

describe('the watchAccounts setting', () => {
  it('is on unless the owner turns it off', () => {
    expect(DEFAULT_SETTINGS.watchAccounts).toBe(true)
  })

  it('stops and starts the ledger the moment it is changed', () => {
    handlers['settings:set'](dashboard, { watchAccounts: false })
    expect(accounts.setWatching).toHaveBeenCalledExactlyOnceWith(false)
    handlers['settings:set'](dashboard, { watchAccounts: true })
    expect(accounts.setWatching).toHaveBeenLastCalledWith(true)
  })

  it('leaves the ledger alone for another setting, or a value that is not yes or no', () => {
    handlers['settings:set'](dashboard, { minimizeToTray: false })
    handlers['settings:set'](dashboard, { watchAccounts: 'false' })
    expect(accounts.setWatching).not.toHaveBeenCalled()
    expect(store.setSettings).toHaveBeenLastCalledWith({})
  })
})
