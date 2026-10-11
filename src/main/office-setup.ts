import { ipcMain, screen, utilityProcess } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { BridgeHost } from './bridge-host'
import { OfficeWindowController } from './office-window'
import { assertTrustedSender, createAppWindow } from './window-factory'
import { PaneFocus } from './pane-focus'
import { parseOrcaEnvironment } from '../bridge/orca'
import { createOfficeService, PS_OPTIONS } from '../office-host/office-service'
import type { FocusResult, OfficeSnapshot } from '../shared/office/types'
import { execFilePromise } from './platform/exec'
import type { SessionTracker } from './session-tracker'
import type { TerminalResolver } from './terminal-resolver'
import type { SettingsStore } from './store'
import { rememberBounds, restoreBounds } from './window-bounds'

type OfficeWindowStore = Pick<SettingsStore, 'getOfficeWindowBounds' | 'setOfficeWindowBounds'>

const DEFAULT_SIZE = { width: 1280, height: 820 }
const MINIMUM_SIZE = { width: 800, height: 560 }

function createOfficeWindow(store: OfficeWindowStore): Electron.BrowserWindow {
  const window = createAppWindow({
    ...restoreBounds(
      store.getOfficeWindowBounds(),
      screen.getAllDisplays().map((display) => display.workArea),
      DEFAULT_SIZE,
      MINIMUM_SIZE
    ),
    minWidth: MINIMUM_SIZE.width,
    minHeight: MINIMUM_SIZE.height,
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
  rememberBounds(window, (bounds) => store.setOfficeWindowBounds(bounds))
  return window
}

export interface Office {
  open: () => void
  // The bridge runs from start to stop, with or without the Office window.
  start: () => void
  stop: () => void
  snapshot: () => OfficeSnapshot | null
  // Jumps to the terminal of a process the session tracker lists; `pid` may be renderer input.
  focusSession: (pid: unknown) => Promise<FocusResult>
}

export function setupOffice(
  terminalResolver: Pick<TerminalResolver, 'resolve'>,
  store: OfficeWindowStore,
  tracker: Pick<SessionTracker, 'getInstances'>
): Office {
  const host = new BridgeHost({
    spawn: () =>
      utilityProcess.fork(join(__dirname, 'bridge.js'), [], {
        serviceName: 'ClaudeWatch Office Bridge'
      })
  })
  const controller = new OfficeWindowController({
    host,
    createWindow: () => createOfficeWindow(store)
  })

  // The same service the standalone web Office runs; here IPC carries it.
  const service = createOfficeService({
    host,
    run: execFilePromise,
    terminalOf: async (pid) => (await terminalResolver.resolve(pid)).terminalType
  })
  const paneFocus = new PaneFocus({
    instances: () => tracker.getInstances(),
    processStart: service.processStart,
    // `ps -E` prints the whole environment; the parser keeps the pane key and drops the rest.
    paneKeyOf: (pid) =>
      execFilePromise('/bin/ps', ['-E', '-o', 'command=', '-p', String(pid)], PS_OPTIONS).then(
        ({ stdout }) => parseOrcaEnvironment(stdout).paneKey,
        () => null
      ),
    focusProcess: service.focusProcess
  })

  ipcMain.handle('office:send', (event, sessionKey: unknown, text: unknown) => {
    assertTrustedSender(event, 'office.html')
    return service.send(sessionKey, text)
  })
  ipcMain.handle(
    'office:respond',
    (event, sessionKey: unknown, decision: unknown, fingerprint: unknown) => {
      assertTrustedSender(event, 'office.html')
      return service.respond(sessionKey, decision, fingerprint)
    }
  )
  ipcMain.handle('office:peek', (event, sessionKey: unknown) => {
    assertTrustedSender(event, 'office.html')
    return service.peek(sessionKey)
  })
  ipcMain.handle('office:start', (event, projectKey: unknown, provider: unknown) => {
    assertTrustedSender(event, 'office.html')
    return service.startAgent(projectKey, provider)
  })
  ipcMain.handle('office:ready', (event) => {
    assertTrustedSender(event, 'office.html')
    controller.ready()
  })
  // 'office:jump' is the HUD's older name for the same routine.
  for (const channel of ['office:focus', 'office:jump']) {
    ipcMain.handle(channel, (event, agentKey: unknown) => {
      assertTrustedSender(event, 'office.html')
      return service.focus(agentKey)
    })
  }

  return {
    open: () => controller.open(),
    start: () => host.start(),
    stop: () => host.stop(),
    snapshot: () => host.snapshot(),
    focusSession: (pid) => paneFocus.focus(pid)
  }
}
