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
import { join } from 'path'
import { pathToFileURL } from 'url'
import { assertTrustedSender, createAppWindow, isAppOrigin } from './window-factory'

// window-factory resolves the renderer next to the main bundle, as electron-vite lays it out.
const rendererUrl = (page: string): string =>
  pathToFileURL(join(__dirname, '../renderer', page)).href

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

  it.each(['will-navigate', 'will-redirect'])(
    'blocks every %s, since app windows never navigate (a dropped file must not load)',
    (name) => {
      createAppWindow({})
      const handler = on.mock.calls.find(([event]) => event === name)?.[1]
      expect(handler).toBeTypeOf('function')
      for (const url of [
        'https://example.com',
        'file:///tmp/dropped.html',
        rendererUrl('office.html'),
        'invalid'
      ]) {
        const preventDefault = vi.fn()
        handler({ preventDefault }, url)
        expect(preventDefault).toHaveBeenCalledOnce()
      }
    }
  )

  it('in production trusts only the app renderer files, not any local file', () => {
    expect(isAppOrigin(`${rendererUrl('index.html')}#popover`)).toBe(true)
    expect(isAppOrigin(rendererUrl('office.html'))).toBe(true)
    for (const url of [
      'file:///tmp/dropped.html',
      'file:///app/index.html',
      pathToFileURL(join(__dirname, '../renderer/../../evil.html')).href,
      'about:blank',
      'data:text/html,x',
      'https://example.com',
      'invalid'
    ]) {
      expect(isAppOrigin(url)).toBe(false)
    }
  })

  it('in development trusts only the renderer dev server origin', () => {
    vi.stubEnv('ELECTRON_RENDERER_URL', 'http://localhost:5173')
    expect(isAppOrigin('http://localhost:5173/office.html')).toBe(true)
    expect(isAppOrigin('http://localhost:5174/')).toBe(false)
    expect(isAppOrigin('file:///tmp/dropped.html')).toBe(false)
  })
})

describe('assertTrustedSender', () => {
  const event = (senderFrame: unknown): Electron.IpcMainInvokeEvent =>
    ({ senderFrame }) as Electron.IpcMainInvokeEvent

  it('accepts a top-level frame on the app origin', () => {
    expect(() =>
      assertTrustedSender(event({ parent: null, url: rendererUrl('office.html') }))
    ).not.toThrow()
  })

  it.each([
    ['no frame', null],
    ['a subframe', { parent: {}, url: rendererUrl('office.html') }],
    ['a dropped local file', { parent: null, url: 'file:///tmp/dropped.html' }],
    ['another origin', { parent: null, url: 'https://example.com/' }]
  ])('rejects %s', (_name, frame) => {
    expect(() => assertTrustedSender(event(frame))).toThrow('Untrusted IPC sender')
  })
})
