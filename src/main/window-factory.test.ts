import { beforeEach, describe, expect, it, vi } from 'vitest'

const { construct, on, setWindowOpenHandler } = vi.hoisted(() => ({
  construct: vi.fn(),
  on: vi.fn(),
  setWindowOpenHandler: vi.fn()
}))
vi.mock('electron', () => ({
  app: { isPackaged: false },
  BrowserWindow: class {
    webContents = { on, setWindowOpenHandler }
    constructor(options: Electron.BrowserWindowConstructorOptions) {
      construct(options)
    }
  }
}))
import { createAppWindow, isAppOrigin } from './window-factory'

beforeEach(() => {
  vi.clearAllMocks()
  vi.unstubAllEnvs()
})

describe('createAppWindow', () => {
  it('overrides insecure preferences while preserving caller options', () => {
    createAppWindow({
      width: 320,
      transparent: true,
      webPreferences: {
        preload: '/preload.js',
        sandbox: false,
        contextIsolation: false,
        nodeIntegration: true,
        webSecurity: false,
        webviewTag: true,
        allowRunningInsecureContent: true
      }
    })
    expect(construct).toHaveBeenCalledWith({
      width: 320,
      transparent: true,
      webPreferences: {
        preload: '/preload.js',
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        webSecurity: true,
        webviewTag: false,
        allowRunningInsecureContent: false
      }
    })
    expect(setWindowOpenHandler.mock.calls[0][0]()).toEqual({ action: 'deny' })
  })

  it.each(['will-navigate', 'will-redirect'])('guards %s with the app origin', (name) => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
    createAppWindow({})
    const handler = on.mock.calls.find(([event]) => event === name)?.[1]
    expect(handler).toBeTypeOf('function')
    for (const url of ['https://example.com', 'http://localhost:5174', 'invalid', 'file:///x']) {
      const preventDefault = vi.fn()
      handler({ preventDefault }, url)
      expect(preventDefault).toHaveBeenCalledOnce()
    }
    const preventDefault = vi.fn()
    handler({ preventDefault }, 'http://localhost:5173/route#popover')
    expect(preventDefault).not.toHaveBeenCalled()
  })

  it('accepts only file protocol in production, not other opaque origins', () => {
    expect(isAppOrigin('file:///app/index.html#popover')).toBe(true)
    for (const url of ['about:blank', 'data:text/html,x', 'https://example.com', 'invalid']) {
      expect(isAppOrigin(url)).toBe(false)
    }
  })
})
