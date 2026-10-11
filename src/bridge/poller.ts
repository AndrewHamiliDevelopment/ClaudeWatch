import { homedir } from 'node:os'
import { join } from 'node:path'
import { type UsageDelta, USAGE_RETENTION_MS } from '../shared/accounts'
import { LIVE_POLL_MS, QUIET_FEED_MS } from '../shared/office/pace'
import type { FeedMessage, OfficeSnapshot } from '../shared/office/types'
import { type BridgeIo, systemIo } from './io'
import { type ClaudeBatch, collectClaude } from './registry'
import { collectCodex } from './codex'
import { claimPanes, OrcaSource } from './orca'
import { type ProcessRow, readProcessTable } from './process-table'
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
  // Whether a Codex session is given the hashed key of its account: only while accounts are watched.
  derivesAccounts?: boolean
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
  private readonly derivesAccounts: boolean
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
    this.derivesAccounts = options.derivesAccounts ?? false
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
    // One process table, read and parsed once, serves both sources: it is the tick's most
    // expensive read.
    let processTable: Promise<ProcessRow[]> | undefined
    const readProcesses = (): Promise<ProcessRow[]> => (processTable ??= readProcessTable(this.io))
    const [claude, codex, orca] = await Promise.all([
      collectClaude(this.roots, this.io, now, this.teammates, readProcesses),
      collectCodex(this.codexRoot, this.io, readProcesses, this.derivesAccounts, now),
      this.orca.poll(now)
    ])
    // The first snapshot goes out with usage unknown, so no window waits on a first scan.
    if (this.snapshot.rev > 0) await this.scanUsage(claude, now)
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
  private async scanUsage(claude: ClaudeBatch, now: number): Promise<void> {
    if (!this.onUsage) return this.usage.scan(claude.transcripts)
    const added: TranscriptDelta[] = []
    // A first scan reads months of lines; the ledger would drop all but the last week of them.
    const oldestKept = now - USAGE_RETENTION_MS
    await this.usage.scan(claude.transcripts, (delta) => {
      if (delta.atMs > oldestKept) added.push(delta)
    })
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
    let postedAtMs = previous.generatedAtMs
    let stopped = false
    let polling = false
    const poll = async (): Promise<void> => {
      if (stopped || polling) return
      polling = true
      try {
        const next = await this.tick()
        if (stopped) return
        const patch = diff(previous, next, next.rev)
        previous = next
        // A tick that changed nothing posts nothing, until the feed has been quiet too long.
        const isEmpty = !patch.upserts.length && !patch.removed.length && !patch.sources
        if (isEmpty && next.generatedAtMs - postedAtMs < QUIET_FEED_MS) return
        postedAtMs = next.generatedAtMs
        post(patch)
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
