import { app, BrowserWindow } from 'electron'

export function isAppOrigin(url: string): boolean {
  try {
    const target = new URL(url)
    const rendererUrl = !app.isPackaged && process.env['ELECTRON_RENDERER_URL']
    if (rendererUrl) {
      const origin = new URL(rendererUrl).origin
      return origin !== 'null' && target.origin === origin
    }
    // Opaque origins also include data: and about:, so check the file protocol explicitly.
    return target.protocol === 'file:' && target.hostname === ''
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
  const guardNavigation = (event: Electron.Event, url: string): void => {
    if (!isAppOrigin(url)) event.preventDefault()
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
