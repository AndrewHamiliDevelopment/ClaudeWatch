import { app, BrowserWindow } from 'electron'
import { join, sep } from 'path'
import { fileURLToPath } from 'url'

// electron-vite puts the renderer pages next to the main bundle; only these files are the app.
const RENDERER_DIR = join(__dirname, '../renderer')

export function isAppOrigin(url: string): boolean {
  try {
    const target = new URL(url)
    const rendererUrl = !app.isPackaged && process.env['ELECTRON_RENDERER_URL']
    if (rendererUrl) {
      const origin = new URL(rendererUrl).origin
      return origin !== 'null' && target.origin === origin
    }
    // Any other local file (one dropped on a window, say) must not inherit the app's bridges.
    if (target.protocol !== 'file:' || target.hostname !== '') return false
    return fileURLToPath(target).startsWith(RENDERER_DIR + sep)
  } catch {
    return false
  }
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

// IPC handlers trust only a top-level frame loaded from the app itself.
export function assertTrustedSender(event: Electron.IpcMainInvokeEvent): void {
  const frame = event?.senderFrame
  if (!frame || frame.parent !== null || !isAppOrigin(frame.url)) {
    throw new Error('Untrusted IPC sender')
  }
}
