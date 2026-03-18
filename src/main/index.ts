import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { ProcessMonitor } from './process-monitor'
import { SessionTracker } from './session-tracker'
import { SettingsStore } from './store'
import { TrayManager } from './tray'
import { NotificationManager } from './notifications'
import { setupIpcHandlers, forwardUpdatesToRenderer } from './ipc-handlers'
import { createWidgetStatsWriter } from './widget-stats-writer'

let mainWindow: BrowserWindow | null = null
let trayManager: TrayManager | null = null
let tracker: SessionTracker | null = null

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 900,
    height: 700,
    minWidth: 600,
    minHeight: 400,
    show: false,
    frame: false,
    transparent: true,
    vibrancy: 'under-window',
    visualEffectState: 'active',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // Hide instead of close (tray app behavior)
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault()
      win.hide()
    }
  })

  // Load the renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

function showDashboard(): void {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    mainWindow.focus()
  }
}

app.whenReady().then(() => {
  // Initialize store and settings
  const store = new SettingsStore()
  const settings = store.getSettings()

  // Initialize process monitor and session tracker
  const monitor = new ProcessMonitor()
  tracker = new SessionTracker(monitor, {
    maxHistoryEntries: settings.maxHistoryEntries
  })

  // Initialize notifications
  const notifications = new NotificationManager(() => store.getSettings())

  // Create window (hidden by default)
  mainWindow = createWindow()

  // Create tray with popover support
  trayManager = new TrayManager({
    onOpenDashboard: showDashboard,
    onQuit: () => {
      app.isQuitting = true
      app.quit()
    },
    preloadPath: join(__dirname, '../preload/index.js')
  })

  // Setup IPC bridge
  setupIpcHandlers({
    tracker,
    store,
    onOpenDashboard: showDashboard
  })

  // Forward tracker updates to renderer windows (main + popover) and tray
  forwardUpdatesToRenderer(
    tracker,
    () => mainWindow,
    () => trayManager?.getPopoverWindow() ?? null
  )

  // Initialize macOS widget stats writer (writes stats.json to App Group container)
  const widgetWriter = createWidgetStatsWriter()
  if (widgetWriter) {
    widgetWriter.ensureContainer().catch(() => {})
  }

  tracker.on('update', (data) => {
    trayManager?.update(data.instances, data.stats)
    // Write stats for macOS WidgetKit widget
    widgetWriter?.write(data.instances, data.stats).catch(() => {
      // Silently ignore widget write errors — widget is optional
    })
  })

  // Wire notification events
  tracker.on('instance-status-changed', ({ instance, previousStatus }) => {
    if (instance.status === 'idle') {
      notifications.notifyIdle(instance)
    }
  })

  tracker.on('instance-exited', (entry) => {
    store.addHistoryEntry(entry)
    notifications.notifyExited(entry)
  })

  // Start polling
  tracker.start(settings.pollingIntervalMs)
})

// macOS: keep app running when all windows are closed (tray app)
app.on('window-all-closed', () => {
  // Do nothing -- tray keeps the app alive
})

// macOS: re-show window when dock icon clicked
app.on('activate', () => {
  showDashboard()
})

// Extend app type for isQuitting flag
declare module 'electron' {
  interface App {
    isQuitting?: boolean
  }
}
