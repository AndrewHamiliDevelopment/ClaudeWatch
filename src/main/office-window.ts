import type { FeedMessage, OfficeSnapshot } from '../shared/office/types'
import type { AppSettings, TerminalType } from '../renderer/lib/types'

export function opensOfficeOnStart(
  settings: Pick<AppSettings, 'openOfficeOnLaunch'>,
  argv: readonly string[]
): boolean {
  return settings.openOfficeOnLaunch === true || argv.includes('--open-office')
}

export interface OfficeWindowLike {
  webContents: { send(channel: string, message: FeedMessage): void }
  focus(): void
  isDestroyed(): boolean
  on(event: 'closed', listener: () => void): unknown
}

interface OfficeWindowDeps {
  host: {
    start(): void
    stop(): void
    snapshot(): OfficeSnapshot | null
    onMessage(listener: (message: FeedMessage) => void): () => void
  }
  createWindow: () => OfficeWindowLike
  openTerminal: (path: string, terminalType?: TerminalType) => Promise<{ success: boolean }>
  resolveTerminalType: (pid: number) => Promise<TerminalType | undefined>
  activateOrca: () => Promise<{ success: boolean }>
}

// The bridge runs only while the Office window exists, so a closed office costs nothing.
export class OfficeWindowController {
  private window: OfficeWindowLike | null = null
  private unsubscribe: (() => void) | null = null

  constructor(private readonly deps: OfficeWindowDeps) {}

  open(): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.focus()
      return
    }
    const window = this.deps.createWindow()
    this.window = window
    this.deps.host.start()
    this.unsubscribe = this.deps.host.onMessage((message) => this.send(message))
    window.on('closed', () => {
      if (this.window !== window) return
      this.unsubscribe?.()
      this.unsubscribe = null
      this.window = null
      this.deps.host.stop()
    })
  }

  // The renderer asks for state once it has subscribed, so no hello is lost to a load race.
  ready(): void {
    const snapshot = this.deps.host.snapshot()
    if (snapshot) this.send({ type: 'hello', v: 1, snapshot })
  }

  async jump(sessionKey: string): Promise<{ success: boolean }> {
    const session = this.deps.host.snapshot()?.sessions.find((s) => s.key === sessionKey)
    if (!session) return { success: false }
    if (session.host === 'orca') return this.deps.activateOrca()
    const terminalType = session.pid ? await this.deps.resolveTerminalType(session.pid) : undefined
    return this.deps.openTerminal(session.cwd, terminalType)
  }

  private send(message: FeedMessage): void {
    if (this.window && !this.window.isDestroyed()) {
      this.window.webContents.send('office:feed', message)
    }
  }
}
