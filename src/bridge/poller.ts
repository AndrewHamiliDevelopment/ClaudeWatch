import { homedir } from 'node:os'
import { join } from 'node:path'
import type { FeedMessage, OfficeSnapshot } from '../shared/office/types'
import { type BridgeIo, systemIo } from './io'
import { collectClaude } from './registry'
import { collectCodex } from './codex'
import { OrcaSource } from './orca'
import { diff, emptySnapshot, reduce } from './reducer'

export interface PollerOptions {
  io?: BridgeIo
  claudeRoots?: string[]
  codexRoot?: string
  now?: () => number
}
export class BridgePoller {
  private snapshot = emptySnapshot()
  private readonly io: BridgeIo
  private readonly orca: OrcaSource
  private readonly roots: string[]
  private readonly codexRoot: string
  private readonly now: () => number
  private pending: Promise<OfficeSnapshot> | null = null
  constructor(options: PollerOptions = {}) {
    this.io = options.io ?? systemIo
    this.orca = new OrcaSource(this.io)
    this.roots = options.claudeRoots ?? [join(homedir(), '.claude')]
    this.codexRoot = options.codexRoot ?? join(homedir(), '.codex')
    this.now = options.now ?? Date.now
  }
  tick(): Promise<OfficeSnapshot> {
    if (this.pending) return this.pending
    this.pending = this.ingest().finally(() => {
      this.pending = null
    })
    return this.pending
  }
  private async ingest(): Promise<OfficeSnapshot> {
    const now = this.now()
    const [claude, codex, orca] = await Promise.all([
      collectClaude(this.roots, this.io, now),
      collectCodex(this.codexRoot, this.io),
      this.orca.poll(now)
    ])
    const sessions = await Promise.all(claude.sessions.map((session) => this.orca.enrich(session)))
    this.snapshot = reduce(this.snapshot, {
      now,
      sessions: [...sessions, ...codex.sessions],
      sources: [...claude.sources, ...codex.sources, orca]
    })
    return this.snapshot
  }
  async start(post: (message: FeedMessage) => void): Promise<() => void> {
    let previous = await this.tick()
    post({ type: 'hello', v: 1, snapshot: previous })
    let stopped = false
    let sequence = 0
    let polling = false
    const poll = async (): Promise<void> => {
      if (stopped || polling) return
      polling = true
      try {
        const next = await this.tick()
        if (stopped) return
        post(diff(previous, next, ++sequence))
        previous = next
      } finally {
        polling = false
      }
    }
    const timer = setInterval(() => {
      void poll()
    }, 2000)
    return () => {
      stopped = true
      clearInterval(timer)
    }
  }
}
