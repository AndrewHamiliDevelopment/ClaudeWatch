import { ipcMain, BrowserWindow, app, shell } from 'electron'
import { isAbsolute, join } from 'path'
import { assertTrustedSender } from './window-factory'
import { DEFAULT_SETTINGS } from '../renderer/lib/types'
import { openTerminal } from './terminal-opener'
import type { SessionTracker } from './session-tracker'
import type { SettingsStore } from './store'
import type { AutoUpdaterManager } from './auto-updater'
import type { UsageStatsReader } from './usage-stats'
import type { PromoChecker } from './promo-checker'
import type { RateLimitReader } from './rate-limit-reader'
import type { NotificationManager } from './notifications'
import type { AppSettings, TerminalType } from '../renderer/lib/types'
import type { TrayManager } from './tray'

const THEMES: readonly unknown[] = ['dark', 'light', 'system']

// A value is kept only when it has the shape of its default: the app boots from this file, so
// a wrong type here (a null group, a NaN interval) would stop the next start.
function hasShapeOf(value: unknown, standard: unknown): boolean {
  if (Array.isArray(standard)) {
    return Array.isArray(value) && value.every((item) => typeof item === 'string')
  }
  if (typeof standard === 'number') return typeof value === 'number' && Number.isFinite(value)
  if (typeof standard === 'object' && standard !== null) {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
  }
  return typeof value === typeof standard
}

function knownEntries(value: object, defaults: object): [string, unknown][] {
  const standard = defaults as Record<string, unknown>
  return Object.entries(value).filter(
    ([key, entry]) => Object.hasOwn(standard, key) && hasShapeOf(entry, standard[key])
  )
}

export function validateSettings(data: Partial<AppSettings>): Partial<AppSettings> {
  if (typeof data !== 'object' || data === null) return {}
  const validated = Object.fromEntries(knownEntries(data, DEFAULT_SETTINGS)) as Partial<AppSettings>
  if (validated.notifications) {
    validated.notifications = Object.fromEntries(
      knownEntries(validated.notifications, DEFAULT_SETTINGS.notifications)
    ) as AppSettings['notifications']
  }
  if (!THEMES.includes(validated.theme)) delete validated.theme

  if (validated.pollingIntervalMs !== undefined) {
    validated.pollingIntervalMs = Math.max(500, Math.min(60000, validated.pollingIntervalMs))
  }
  if (validated.cpuIdleThreshold !== undefined) {
    validated.cpuIdleThreshold = Math.max(0.1, Math.min(100, validated.cpuIdleThreshold))
  }
  if (validated.maxHistoryEntries !== undefined) {
    validated.maxHistoryEntries = Math.max(1, Math.min(10000, validated.maxHistoryEntries))
  }
  if (validated.weeklyTokenTarget !== undefined) {
    validated.weeklyTokenTarget = Math.max(
      100_000,
      Math.min(100_000_000, validated.weeklyTokenTarget)
    )
  }
  if (validated.staleThresholdMinutes !== undefined) {
    validated.staleThresholdMinutes = Math.max(5, Math.min(120, validated.staleThresholdMinutes))
  }
  if (validated.notifications?.cooldownSeconds !== undefined) {
    validated.notifications = {
      ...validated.notifications,
      cooldownSeconds: Math.max(10, Math.min(120, validated.notifications.cooldownSeconds))
    }
  }

  return validated
}

const TERMINAL_TYPES = {
  'terminal-app': true,
  iterm2: true,
  warp: true,
  alacritty: true,
  kitty: true,
  wezterm: true,
  hyper: true,
  ghostty: true,
  vscode: true,
  cursor: true,
  tmux: true,
  screen: true,
  unknown: true
} satisfies Record<TerminalType, boolean>

function isTerminalType(value: unknown): value is TerminalType {
  return typeof value === 'string' && Object.hasOwn(TERMINAL_TYPES, value)
}

interface IpcHandlerOptions {
  tracker: Pick<
    SessionTracker,
    'getInstances' | 'getStats' | 'setStaleThreshold' | 'setCooldownSeconds'
  >
  store: Pick<SettingsStore, 'getSettings' | 'setSettings' | 'getHistory' | 'clearHistory'>
  updater?: Pick<AutoUpdaterManager, 'checkForUpdates' | 'downloadUpdate' | 'quitAndInstall'>
  usageReader?: Pick<UsageStatsReader, 'getLastData' | 'read' | 'setWeeklyTokenTarget'>
  promoChecker?: Pick<PromoChecker, 'getLastData'>
  rateLimitReader?: Pick<
    RateLimitReader,
    'getLastData' | 'isStatuslineConfigured' | 'setupStatusline'
  >
  notifications?: Pick<NotificationManager, 'isSupported' | 'sendTest'>
  onOpenDashboard: () => void
  getTrayManager?: () => TrayManager | null
}

export function setupIpcHandlers(options: IpcHandlerOptions): void {
  const {
    tracker,
    store,
    updater,
    usageReader,
    promoChecker,
    rateLimitReader,
    notifications,
    onOpenDashboard,
    getTrayManager
  } = options

  const handle = (channel: string, listener: Parameters<typeof ipcMain.handle>[1]): void => {
    ipcMain.handle(channel, (event, ...args) => {
      assertTrustedSender(event, 'index.html')
      return listener(event, ...args)
    })
  }

  const beginQuit = (): void => {
    app.isQuitting = true
  }

  handle('instances:get', () => {
    return {
      instances: tracker.getInstances(),
      stats: tracker.getStats()
    }
  })

  handle('settings:get', () => store.getSettings())

  handle('settings:set', (_event: Electron.IpcMainInvokeEvent, data: Partial<AppSettings>) => {
    const validated = validateSettings(data)
    store.setSettings(validated)
    const updated = store.getSettings()
    if (validated.weeklyTokenTarget !== undefined && usageReader) {
      usageReader.setWeeklyTokenTarget(updated.weeklyTokenTarget)
    }
    if (validated.launchAtLogin !== undefined) {
      app.setLoginItemSettings({ openAtLogin: validated.launchAtLogin })
    }
    if (validated.staleThresholdMinutes !== undefined) {
      tracker.setStaleThreshold(updated.staleThresholdMinutes)
    }
    if (validated.notifications?.cooldownSeconds !== undefined) {
      tracker.setCooldownSeconds(updated.notifications.cooldownSeconds)
    }
    return updated
  })

  handle('history:get', () => store.getHistory())

  handle('history:clear', () => {
    store.clearHistory()
    return { success: true }
  })

  handle('app:open-dashboard', () => {
    onOpenDashboard()
    return { success: true }
  })

  handle('app:quit', () => {
    beginQuit()
    app.quit()
  })

  handle('updater:check', () => {
    updater?.checkForUpdates()
  })

  handle('updater:download', () => {
    updater?.downloadUpdate()
  })

  handle('updater:install', () => {
    if (!updater) return

    beginQuit()
    updater.quitAndInstall()
  })

  handle('usage:get', () => usageReader?.getLastData() ?? null)

  handle('usage:refresh', async () => usageReader?.read() ?? null)

  handle('promo:get', () => promoChecker?.getLastData() ?? null)

  handle('ratelimits:get', () => rateLimitReader?.getLastData() ?? null)

  handle(
    'ratelimits:statusline-status',
    async () => rateLimitReader?.isStatuslineConfigured() ?? false
  )

  handle('ratelimits:setup-statusline', async () => {
    if (!rateLimitReader) return false
    const scriptSource = join(
      app.isPackaged ? process.resourcesPath : app.getAppPath(),
      'resources',
      'claudewatch-statusline.sh'
    )
    return rateLimitReader.setupStatusline(scriptSource)
  })

  handle('notifications:check-permission', () => ({
    supported: notifications?.isSupported() ?? false
  }))

  handle('notifications:open-settings', () => {
    shell.openExternal('x-apple.systempreferences:com.apple.preference.notifications')
  })

  handle('notifications:send-test', () => {
    if (!notifications) return { sent: false, reason: 'Notification manager not available' }
    return notifications.sendTest()
  })

  handle(
    'notifications:mute-project',
    (_event: Electron.IpcMainInvokeEvent, projectPath: string) => {
      const settings = store.getSettings()
      const mutedProjects = settings.notifications.mutedProjects ?? []
      if (!mutedProjects.includes(projectPath)) {
        mutedProjects.push(projectPath)
      }
      store.setSettings({
        notifications: { ...settings.notifications, mutedProjects }
      })
      return { success: true }
    }
  )

  handle(
    'notifications:unmute-project',
    (_event: Electron.IpcMainInvokeEvent, projectPath: string) => {
      const settings = store.getSettings()
      const mutedProjects = (settings.notifications.mutedProjects ?? []).filter(
        (p) => p !== projectPath
      )
      store.setSettings({
        notifications: { ...settings.notifications, mutedProjects }
      })
      return { success: true }
    }
  )

  handle(
    'terminal:open',
    (_event: Electron.IpcMainInvokeEvent, projectPath: string, terminalType?: string) => {
      if (!projectPath || typeof projectPath !== 'string' || !isAbsolute(projectPath)) {
        return { success: false }
      }
      if (terminalType !== undefined && !isTerminalType(terminalType)) return { success: false }
      return openTerminal(projectPath, terminalType)
    }
  )

  handle('popover:set-pinned', (_event: Electron.IpcMainInvokeEvent, pinned: boolean) => {
    const tray = getTrayManager?.()
    if (!tray) return { success: false }
    tray.setPinned(pinned)
    return { success: true }
  })

  handle('popover:get-pinned', () => {
    const tray = getTrayManager?.()
    return tray?.isPinned() ?? false
  })

  handle('popover:close', () => {
    const tray = getTrayManager?.()
    if (!tray) return { success: false }
    tray.closePopover()
    return { success: true }
  })
}

export function forwardUpdatesToRenderer(
  tracker: Pick<SessionTracker, 'on'>,
  ...getWindows: (() => BrowserWindow | null)[]
): void {
  tracker.on('update', (data) => {
    for (const getWindow of getWindows) {
      const win = getWindow()
      if (win && !win.isDestroyed()) {
        win.webContents.send('instances:update', data)
      }
    }
  })
}
