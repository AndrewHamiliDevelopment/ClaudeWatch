import { ipcMain, utilityProcess } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { BridgeHost } from './bridge-host'
import { OfficeWindowController } from './office-window'
import { assertTrustedSender, createAppWindow } from './window-factory'
import { openTerminal } from './terminal-opener'
import { execFilePromise } from './platform/exec'
import type { TerminalResolver } from './terminal-resolver'

function createOfficeWindow(): Electron.BrowserWindow {
  const window = createAppWindow({
    width: 1280,
    height: 820,
    minWidth: 800,
    minHeight: 560,
    title: 'ClaudeWatch Office',
    backgroundColor: '#0E0E10',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    webPreferences: { preload: join(__dirname, '../preload/office.js') }
  })
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/office.html`)
  } else {
    window.loadFile(join(__dirname, '../renderer/office.html'))
  }
  return window
}

export function setupOffice(terminalResolver: Pick<TerminalResolver, 'resolve'>): {
  open: () => void
} {
  const host = new BridgeHost({
    spawn: () =>
      utilityProcess.fork(join(__dirname, 'bridge.js'), [], {
        serviceName: 'ClaudeWatch Office Bridge'
      })
  })
  const controller = new OfficeWindowController({
    host,
    createWindow: createOfficeWindow,
    openTerminal,
    resolveTerminalType: async (pid) => (await terminalResolver.resolve(pid)).terminalType,
    activateOrca: () =>
      execFilePromise('open', ['-a', 'Orca']).then(
        () => ({ success: true }),
        () => ({ success: false })
      )
  })

  ipcMain.handle('office:ready', (event) => {
    assertTrustedSender(event)
    controller.ready()
  })
  ipcMain.handle('office:jump', (event, sessionKey: unknown) => {
    assertTrustedSender(event)
    if (typeof sessionKey !== 'string') return { success: false }
    return controller.jump(sessionKey)
  })

  return { open: () => controller.open() }
}
