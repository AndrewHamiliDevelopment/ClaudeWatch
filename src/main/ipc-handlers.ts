import { ipcMain, BrowserWindow, app, shell } from 'electron'
import { isAbsolute, join } from 'path'
import { assertTrustedSender } from './window-factory'
import { conformSettings } from './settings-shape'
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

// One rule set for what a valid setting is, shared with the store's read path.
export const validateSettings = conformSettings

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
