import { applyFeed } from '../shared/office/apply-feed'
import { isFeedMessage } from '../shared/office/feed-message'
import { LIVE_POLL_MS, type PaceMessage } from '../shared/office/pace'
import type { FeedMessage, OfficeSnapshot } from '../shared/office/types'

// The subset of Electron's UtilityProcess the host relies on, so tests can fake it.
export interface BridgeProcess {
  on(event: 'message', listener: (data: unknown) => void): unknown
  on(event: 'exit', listener: (code: number) => void): unknown
  kill(): boolean
  // Absent on a bridge that runs in this process: it polls only while it is watched.
  postMessage?(message: PaceMessage): void
}

interface BridgeHostOptions {
  spawn: () => BridgeProcess
}

const FIRST_RESTART_DELAY_MS = 1_000
const MAX_RESTART_DELAY_MS = 30_000

// Runs the bridge only while something (the Office window) needs it, and keeps the
// folded snapshot so a window that opens later starts from current state.
export class BridgeHost {
  private readonly spawn: () => BridgeProcess
  private child: BridgeProcess | null = null
  private running = false
  private restartTimer: NodeJS.Timeout | null = null
  private restartDelayMs = FIRST_RESTART_DELAY_MS
  private latest: OfficeSnapshot | null = null
  private pollIntervalMs = LIVE_POLL_MS
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

  // Replaces a running bridge, whose sessions stop being facts; starts none when stopped.
  restart(): void {
    if (!this.running) return
    this.stop()
    for (const listener of this.listeners) listener({ type: 'resync' })
    this.start()
  }

  snapshot(): OfficeSnapshot | null {
    return this.latest
  }

  // How often the bridge polls, now and after any restart.
  setPollInterval(intervalMs: number): void {
    if (intervalMs === this.pollIntervalMs) return
    this.pollIntervalMs = intervalMs
    this.tellPace(this.child)
  }

  private tellPace(child: BridgeProcess | null): void {
    child?.postMessage?.({ type: 'pace', intervalMs: this.pollIntervalMs })
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
      if (data.type === 'hello') {
        this.restartDelayMs = FIRST_RESTART_DELAY_MS
        // A fresh bridge polls live; its hello is the first moment it is known to be listening.
        if (this.pollIntervalMs !== LIVE_POLL_MS) this.tellPace(child)
      }
      this.latest = applyFeed(this.latest, data)
      for (const listener of this.listeners) listener(data)
    })
    child.on('exit', () => {
      if (child !== this.child || !this.running) return
      this.child = null
      // A dead bridge's sessions are no longer facts: nothing may act on them until a new hello.
      this.latest = null
      for (const listener of this.listeners) listener({ type: 'resync' })
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
