import { applyFeed } from '../shared/office/apply-feed'
import type { FeedMessage, OfficeSnapshot } from '../shared/office/types'

// The subset of Electron's UtilityProcess the host relies on, so tests can fake it.
export interface BridgeProcess {
  on(event: 'message', listener: (data: unknown) => void): unknown
  on(event: 'exit', listener: (code: number) => void): unknown
  kill(): boolean
}

interface BridgeHostOptions {
  spawn: () => BridgeProcess
}

const FIRST_RESTART_DELAY_MS = 1_000
const MAX_RESTART_DELAY_MS = 30_000

function isFeedMessage(data: unknown): data is FeedMessage {
  if (typeof data !== 'object' || data === null || !('type' in data)) return false
  if (data.type === 'resync') return true
  return (data.type === 'hello' || data.type === 'patch') && 'v' in data && data.v === 1
}

// Runs the bridge only while something (the Office window) needs it, and keeps the
// folded snapshot so a window that opens later starts from current state.
export class BridgeHost {
  private readonly spawn: () => BridgeProcess
  private child: BridgeProcess | null = null
  private running = false
  private restartTimer: NodeJS.Timeout | null = null
  private restartDelayMs = FIRST_RESTART_DELAY_MS
  private latest: OfficeSnapshot | null = null
  private readonly listeners = new Set<(message: FeedMessage) => void>()

  constructor(options: BridgeHostOptions) {
    this.spawn = options.spawn
  }

  start(): void {
    if (this.running) return
    this.running = true
    this.launch()
  }

  stop(): void {
    this.running = false
    if (this.restartTimer) clearTimeout(this.restartTimer)
    this.restartTimer = null
    this.child?.kill()
    this.child = null
    this.latest = null
    this.restartDelayMs = FIRST_RESTART_DELAY_MS
  }

  snapshot(): OfficeSnapshot | null {
    return this.latest
  }

  onMessage(listener: (message: FeedMessage) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private launch(): void {
    const child = this.spawn()
    this.child = child
    child.on('message', (data) => {
      if (child !== this.child || !isFeedMessage(data)) return
      if (data.type === 'hello') this.restartDelayMs = FIRST_RESTART_DELAY_MS
      this.latest = applyFeed(this.latest, data)
      for (const listener of this.listeners) listener(data)
    })
    child.on('exit', () => {
      if (child !== this.child || !this.running) return
      this.child = null
      this.scheduleRestart()
    })
  }

  private scheduleRestart(): void {
    const delay = this.restartDelayMs
    this.restartDelayMs = Math.min(delay * 2, MAX_RESTART_DELAY_MS)
    this.restartTimer = setTimeout(() => {
      this.restartTimer = null
      this.launch()
    }, delay)
  }
}
