import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { fileURLToPath } from 'url'

export type AppPage = 'index.html' | 'office.html'
const APP_PAGES: readonly AppPage[] = ['index.html', 'office.html']

// electron-vite puts the renderer pages next to the main bundle; only these two files are the app.
const RENDERER_DIR = join(__dirname, '../renderer')

// Which app page a URL is, or null. Any other document (a dropped local file, say) is not the app.
function appPageOf(url: string): AppPage | null {
  try {
    const target = new URL(url)
    const rendererUrl = !app.isPackaged && process.env['ELECTRON_RENDERER_URL']
    if (rendererUrl) {
      if (target.origin === 'null' || target.origin !== new URL(rendererUrl).origin) return null
      const page = target.pathname === '/' ? 'index.html' : target.pathname.slice(1)
      return APP_PAGES.find((candidate) => candidate === page) ?? null
    }
    if (target.protocol !== 'file:' || target.hostname !== '') return null
    const path = fileURLToPath(target)
    return APP_PAGES.find((page) => path === join(RENDERER_DIR, page)) ?? null
  } catch {
    return null
  }
}

export function isAppOrigin(url: string): boolean {
  return appPageOf(url) !== null
}

export function createAppWindow(options: Electron.BrowserWindowConstructorOptions): BrowserWindow {
  const window = new BrowserWindow({
    ...options,
    webPreferences: {
      ...options.webPreferences,
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
      webviewTag: false,
      allowRunningInsecureContent: false
    }
  })
  // App windows never navigate (routing is by hash), so any navigation is refused outright.
  const guardNavigation = (event: Electron.Event): void => {
    event.preventDefault()
  }
  window.webContents.on('will-navigate', guardNavigation)
  window.webContents.on('will-redirect', guardNavigation)
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  return window
}

// Each IPC channel belongs to one page: the dashboard and popover (index.html) or the Office.
export function assertTrustedSender(event: Electron.IpcMainInvokeEvent, page: AppPage): void {
  const frame = event?.senderFrame
  if (!frame || frame.parent !== null || appPageOf(frame.url) !== page) {
    throw new Error('Untrusted IPC sender')
  }
}

// Registers a handler that answers its own page only, so no channel can be added without the check.
export function handleTrusted(
  page: AppPage,
  channel: string,
  listener: Parameters<typeof ipcMain.handle>[1]
): void {
  ipcMain.handle(channel, (event, ...args) => {
    assertTrustedSender(event, page)
    return listener(event, ...args)
  })
}
