import { screen, utilityProcess } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { BridgeHost } from './bridge-host'
import { OfficeWindowController } from './office-window'
import { createAppWindow, handleTrusted } from './window-factory'
import { PaneFocus } from './pane-focus'
import { readOrcaEnvironment } from '../bridge/orca'
import { createOfficeService, PS_OPTIONS } from '../office-host/office-service'
import type { FocusResult, OfficeSnapshot } from '../shared/office/types'
import { execFilePromise } from './platform/exec'
import type { SessionTracker } from './session-tracker'
import type { TerminalResolver } from './terminal-resolver'
import type { SettingsStore } from './store'
import { rememberBounds, restoreBounds } from './window-bounds'
import { type AccountLedger, type OfficeAccounts, withAccounts } from './accounts'

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
  // How often the bridge polls: live while a window shows its data, slowly otherwise.
  setPollInterval: (intervalMs: number) => void
  // Jumps to the terminal of a process the session tracker lists; `pid` may be renderer input.
  focusSession: (pid: unknown) => Promise<FocusResult>
}

export function setupOffice(
  terminalResolver: Pick<TerminalResolver, 'resolve'>,
  store: OfficeWindowStore,
  tracker: Pick<SessionTracker, 'getInstances'>,
  accounts: OfficeAccounts & Pick<AccountLedger, 'ingestBridgeMessage' | 'observeSessions'>
): Office {
  const bridge = new BridgeHost({
    spawn: () => {
      const child = utilityProcess.fork(join(__dirname, 'bridge.js'), [], {
        serviceName: 'ClaudeWatch Office Bridge'
      })
      // Token counts travel beside the feed, as their own message, and only the ledger reads them.
      child.on('message', (message: unknown) => accounts.ingestBridgeMessage(message))
      return child
    }
  })
  bridge.onMessage(() => accounts.observeSessions(bridge.snapshot()?.sessions ?? []))
  const host = withAccounts(bridge, accounts)
  const controller = new OfficeWindowController({
    host,
    createWindow: () => createOfficeWindow(store)
  })

  // The same service the standalone web Office runs; here IPC carries it.
  const service = createOfficeService({
    host,
    run: execFilePromise,
    terminalOf: async (pid) => (await terminalResolver.resolve(pid)).terminalType,
    isInteractive: true
  })
  const paneFocus = new PaneFocus({
    instances: () => tracker.getInstances(),
    processStart: service.processStart,
    // `ps -E` prints the whole environment; the reader keeps the pane key and drops the rest.
    paneKeyOf: (pid) =>
      readOrcaEnvironment(pid, async (args) => {
        return (await execFilePromise('/bin/ps', args, PS_OPTIONS)).stdout
      }).then(
        ({ paneKey }) => paneKey,
        () => null
      ),
    focusProcess: service.focusProcess
  })

  const handle = (channel: string, listener: Parameters<typeof handleTrusted>[2]): void =>
    handleTrusted('office.html', channel, listener)
  handle('office:send', (_event, sessionKey: unknown, text: unknown) =>
    service.send(sessionKey, text)
  )
  handle('office:respond', (_event, sessionKey: unknown, decision: unknown, fingerprint: unknown) =>
    service.respond(sessionKey, decision, fingerprint)
  )
  handle('office:peek', (_event, sessionKey: unknown) => service.peek(sessionKey))
  handle('office:start', (_event, projectKey: unknown, provider: unknown) =>
    service.startAgent(projectKey, provider)
  )
  handle('office:ready', () => controller.ready())
  handle('office:focus', (_event, agentKey: unknown) => service.focus(agentKey))

  return {
    open: () => controller.open(),
    start: () => bridge.start(),
    stop: () => bridge.stop(),
    snapshot: () => host.snapshot(),
    setPollInterval: (intervalMs) => bridge.setPollInterval(intervalMs),
    focusSession: (pid) => paneFocus.focus(pid)
  }
}
