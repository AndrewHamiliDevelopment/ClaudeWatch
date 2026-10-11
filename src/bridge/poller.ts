import { homedir } from 'node:os'
import { join } from 'node:path'
import type { UsageDelta } from '../shared/accounts'
import { LIVE_POLL_MS } from '../shared/office/pace'
import type { FeedMessage, OfficeSnapshot } from '../shared/office/types'
import { type BridgeIo, systemIo } from './io'
import { type ClaudeBatch, collectClaude } from './registry'
import { collectCodex } from './codex'
import { claimPanes, OrcaSource } from './orca'
import { PROCESS_TABLE_ARGS } from './process-table'
import { diff, emptySnapshot, reduce } from './reducer'
import { TeammateSource } from './teammates'
import { UsageThrottle } from './usage-throttle'
import { type TranscriptDelta, UsageTracker } from './usage-tracker'

export interface PollerOptions {
  io?: BridgeIo
  claudeRoots?: string[]
  codexRoot?: string
  now?: () => number
  // Hears the tokens every tick added, line by line, for whoever attributes them to an account.
  onUsage?: (deltas: UsageDelta[]) => void
}
export class BridgePoller {
  private snapshot = emptySnapshot()
  private intervalMs = LIVE_POLL_MS
  // Set while polling: restarts the timer at the current interval, and polls now if asked.
  private repace: ((pollNow: boolean) => void) | null = null
  private readonly io: BridgeIo
  private readonly orca: OrcaSource
  private readonly teammates: TeammateSource
  private readonly usage: UsageTracker
  private readonly throttle = new UsageThrottle()
  private readonly roots: string[]
  private readonly codexRoot: string
  private readonly now: () => number
  private readonly onUsage: PollerOptions['onUsage']
  private pending: Promise<OfficeSnapshot> | null = null
  constructor(options: PollerOptions = {}) {
    this.io = options.io ?? systemIo
    this.orca = new OrcaSource(this.io)
    this.teammates = new TeammateSource(this.io)
    this.usage = new UsageTracker(this.io)
    this.roots = options.claudeRoots ?? [join(homedir(), '.claude')]
    this.codexRoot = options.codexRoot ?? join(homedir(), '.codex')
    this.now = options.now ?? Date.now
    this.onUsage = options.onUsage
  }
  tick(): Promise<OfficeSnapshot> {
    if (this.pending) return this.pending
    this.pending = this.ingest().finally(() => {
      this.pending = null
    })
    return this.pending
  }
  // True until every live transcript has been counted; a one-shot run waits on it.
  get isCountingUsage(): boolean {
    return this.usage.isBehind
  }
  private async ingest(): Promise<OfficeSnapshot> {
    const now = this.now()
    // One process table serves both sources: it is the tick's most expensive read.
    let processTable: Promise<string> | undefined
    const readProcessTable = (): Promise<string> =>
      (processTable ??= this.io.exec('/bin/ps', PROCESS_TABLE_ARGS))
    const [claude, codex, orca] = await Promise.all([
      collectClaude(this.roots, this.io, now, this.teammates, readProcessTable),
      collectCodex(this.codexRoot, this.io, readProcessTable),
      this.orca.poll(now)
    ])
    // The first snapshot goes out with usage unknown, so no window waits on a first scan.
    if (this.snapshot.rev > 0) await this.scanUsage(claude)
    this.orca.prune(claude.sessions)
    const enriched = claimPanes(
      await Promise.all(claude.sessions.map((session) => this.orca.enrich(session, now)))
    )
    const sessions = [...enriched.map((session) => this.usage.fill(session)), ...codex.sessions]
    this.throttle.prune(new Set(sessions.map((session) => session.key)))
    this.snapshot = reduce(this.snapshot, {
      now,
      sessions: sessions.map((session) => this.throttle.apply(session, now)),
      sources: [...claude.sources, ...codex.sources, orca, this.usage.health()]
    })
    return this.snapshot
  }
  private async scanUsage(claude: ClaudeBatch): Promise<void> {
    if (!this.onUsage) return this.usage.scan(claude.transcripts)
    const added: TranscriptDelta[] = []
    await this.usage.scan(claude.transcripts, (delta) => added.push(delta))
    const sessions = new Map(claude.sessions.map((session) => [session.key, session]))
    const deltas = added.flatMap((delta): UsageDelta[] => {
      const session = sessions.get(delta.sessionKey)
      return session
        ? [{ ...delta, projectKey: session.projectKey, projectLabel: session.projectLabel }]
        : []
    })
    if (deltas.length) this.onUsage(deltas)
  }
  async start(post: (message: FeedMessage) => void): Promise<() => void> {
    let previous = await this.tick()
    post({ type: 'hello', v: 1, snapshot: previous })
    let stopped = false
    let polling = false
    const poll = async (): Promise<void> => {
      if (stopped || polling) return
      polling = true
      try {
        const next = await this.tick()
        if (stopped) return
        post(diff(previous, next, next.rev))
        previous = next
      } catch {
        // The next tick tries again. The cause may name local paths, so it is not written out.
        process.stderr.write('Office bridge tick failed\n')
      } finally {
        polling = false
      }
    }
    let timer: NodeJS.Timeout | undefined
    this.repace = (pollNow) => {
      clearInterval(timer)
      timer = setInterval(() => void poll(), this.intervalMs)
      if (pollNow) void poll()
    }
    this.repace(false)
    return () => {
      stopped = true
      this.repace = null
      clearInterval(timer)
    }
  }

  // Changes how often the poll repeats. Speeding up polls at once, so a window that has just
  // come back does not wait out the slow interval to show current state.
  setIntervalMs(intervalMs: number): void {
    const isFaster = intervalMs < this.intervalMs
    this.intervalMs = intervalMs
    this.repace?.(isFaster)
  }
}
