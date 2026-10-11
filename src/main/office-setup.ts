import { ipcMain, utilityProcess } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { BridgeHost } from './bridge-host'
import { OfficeWindowController } from './office-window'
import { assertTrustedSender, createAppWindow } from './window-factory'
import { openTerminal, openTerminalRunning } from './terminal-opener'
import { OfficeInteractions } from './office-interactions'
import { OrcaTerminals } from './orca-terminals'
import type { PermissionDecision, ProviderId } from '../shared/office/types'
import { execFilePromise } from './platform/exec'
import type { TerminalResolver } from './terminal-resolver'

// The app bundle's CLI, not whatever `orca` is first on PATH.
const ORCA_CLI = '/Applications/Orca.app/Contents/Resources/bin/orca'
const ORCA_TIMEOUT_MS = 15_000

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

  const interactions = new OfficeInteractions({
    snapshot: () => host.snapshot(),
    orca: new OrcaTerminals(async (args) => {
      const { stdout } = await execFilePromise(ORCA_CLI, args, { timeout: ORCA_TIMEOUT_MS })
      return stdout
    }),
    openTerminalRunning
  })
  const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

  ipcMain.handle('office:send', (event, sessionKey: unknown, text: unknown) => {
    assertTrustedSender(event)
    return interactions.send(asString(sessionKey), asString(text))
  })
  ipcMain.handle(
    'office:respond',
    (event, sessionKey: unknown, decision: unknown, fingerprint: unknown) => {
      assertTrustedSender(event)
      return interactions.respond(
        asString(sessionKey),
        asString(decision) as PermissionDecision,
        asString(fingerprint)
      )
    }
  )
  ipcMain.handle('office:peek', (event, sessionKey: unknown) => {
    assertTrustedSender(event)
    return interactions.peek(asString(sessionKey))
  })
  ipcMain.handle('office:start', (event, projectKey: unknown, provider: unknown) => {
    assertTrustedSender(event)
    return interactions.start(asString(projectKey), asString(provider) as ProviderId)
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
