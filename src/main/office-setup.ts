import { ipcMain, screen, utilityProcess } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { BridgeHost } from './bridge-host'
import { OfficeWindowController } from './office-window'
import { assertTrustedSender, createAppWindow } from './window-factory'
import { openTerminal, openTerminalRunning } from './terminal-opener'
import { OfficeInteractions } from './office-interactions'
import { OrcaTerminals } from './orca-terminals'
import { createOrcaCli } from './orca-cli'
import { PaneFocus } from './pane-focus'
import { parseOrcaEnvironment } from '../bridge/orca'
import type {
  FocusResult,
  OfficeSnapshot,
  PermissionDecision,
  ProviderId
} from '../shared/office/types'
import { execFilePromise } from './platform/exec'
import type { SessionTracker } from './session-tracker'
import type { TerminalResolver } from './terminal-resolver'
import type { SettingsStore } from './store'
import { rememberBounds, restoreBounds } from './window-bounds'
import { type AccountLedger, type OfficeAccounts, withAccounts } from './accounts'

const PS_OPTIONS = { timeout: 5000, env: { LC_ALL: 'C', TZ: 'UTC' } }

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

  const orcaCli = createOrcaCli(execFilePromise)
  // The bridge's own process identity: `ps` start time, read in C locale and UTC.
  const processStart = (pid: number): Promise<number | null> =>
    execFilePromise('/bin/ps', ['-o', 'lstart=', '-p', String(pid)], PS_OPTIONS).then(
      ({ stdout }) => Date.parse(`${stdout.trim()} UTC`) || null,
      () => null
    )
  const interactions = new OfficeInteractions({
    snapshot: () => bridge.snapshot(),
    orca: new OrcaTerminals(orcaCli.exec),
    openTerminalRunning,
    processStart,
    raiseOrca: orcaCli.raise,
    openFolder: async (path, pid) =>
      openTerminal(
        path,
        pid === null ? undefined : (await terminalResolver.resolve(pid)).terminalType
      )
  })
  const paneFocus = new PaneFocus({
    instances: () => tracker.getInstances(),
    processStart,
    // `ps -E` prints the whole environment; the parser keeps the pane key and drops the rest.
    paneKeyOf: (pid) =>
      execFilePromise('/bin/ps', ['-E', '-o', 'command=', '-p', String(pid)], PS_OPTIONS).then(
        ({ stdout }) => parseOrcaEnvironment(stdout).paneKey,
        () => null
      ),
    focusProcess: (owner) => interactions.focusProcess(owner)
  })
  const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
  const isDecision = (value: unknown): value is PermissionDecision =>
    value === 'approve' || value === 'deny'
  const isProvider = (value: unknown): value is ProviderId =>
    value === 'claude' || value === 'codex'
  const invalid = { success: false, reason: 'invalid-input' } as const

  ipcMain.handle('office:send', (event, sessionKey: unknown, text: unknown) => {
    assertTrustedSender(event, 'office.html')
    return interactions.send(asString(sessionKey), asString(text))
  })
  ipcMain.handle(
    'office:respond',
    (event, sessionKey: unknown, decision: unknown, fingerprint: unknown) => {
      assertTrustedSender(event, 'office.html')
      if (!isDecision(decision)) return invalid
      return interactions.respond(asString(sessionKey), decision, asString(fingerprint))
    }
  )
  ipcMain.handle('office:peek', (event, sessionKey: unknown) => {
    assertTrustedSender(event, 'office.html')
    return interactions.peek(asString(sessionKey))
  })
  ipcMain.handle('office:start', (event, projectKey: unknown, provider: unknown) => {
    assertTrustedSender(event, 'office.html')
    if (!isProvider(provider)) return invalid
    return interactions.start(asString(projectKey), provider)
  })
  ipcMain.handle('office:ready', (event) => {
    assertTrustedSender(event, 'office.html')
    controller.ready()
  })
  // 'office:jump' is the HUD's older name for the same routine.
  for (const channel of ['office:focus', 'office:jump']) {
    ipcMain.handle(channel, (event, agentKey: unknown) => {
      assertTrustedSender(event, 'office.html')
      return interactions.focus(asString(agentKey))
    })
  }

  return {
    open: () => controller.open(),
    start: () => bridge.start(),
    stop: () => bridge.stop(),
    snapshot: () => host.snapshot(),
    focusSession: (pid) => paneFocus.focus(pid)
  }
}
