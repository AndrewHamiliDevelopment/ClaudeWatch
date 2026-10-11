import type { UsageDelta } from '../shared/accounts'
import type { SessionRef, SessionUsage, SourceHealth, TokenCounts } from '../shared/office/types'
import { type BridgeIo, isMissing } from './io'
import type { AgentFile } from './subagents'
import {
  addCounts,
  contextTokens,
  emptyFold,
  foldLines,
  foldTotal,
  type UsageFold,
  type UsageIncrement,
  zeroCounts
} from './usage-fold'

// What one line added to one transcript; the poller adds the session's project.
export type TranscriptDelta = Omit<UsageDelta, 'projectKey' | 'projectLabel'>

export interface SessionFiles {
  main: string
  // Every agent transcript under the session, finished ones included: they spent the tokens.
  agents: AgentFile[]
  // Teammate id to its own transcript, followed by those of the agents it spawned.
  teammates: Map<string, string[]>
}

interface TrackedFile {
  offset: number
  fold: UsageFold
  hasReachedEnd: boolean
}

// 650 MB of live transcripts are counted within three ticks, and one tick stays near 150 ms.
const TICK_BUDGET_BYTES = 256 * 1024 * 1024
// The longest transcript line measured is 1.3 MB; a read this size always holds a whole one.
const CHUNK_BYTES = 8 * 1024 * 1024

const spawnedPaths = (files: SessionFiles): string[] => [
  ...files.agents.map((agent) => agent.path),
  ...[...files.teammates.values()].flat()
]

export class UsageTracker {
  private readonly budgetBytes: number
  private readonly chunkBytes: number
  private files = new Map<string, TrackedFile>()
  private sessions: ReadonlyMap<string, SessionFiles> = new Map()
  private counted = new Set<string>()
  private behind = true
  private failed = false

  constructor(
    private readonly io: BridgeIo,
    limits: { budgetBytes?: number; chunkBytes?: number } = {}
  ) {
    this.budgetBytes = limits.budgetBytes ?? TICK_BUDGET_BYTES
    this.chunkBytes = limits.chunkBytes ?? CHUNK_BYTES
  }

  // Reads what was appended since the last scan, up to the byte budget. State for a transcript
  // that is no longer wanted is dropped here, so it stays bounded however long the bridge runs.
  // `onAdded` hears what every newly read line added. A transcript read again from its start
  // is reported again, so the listener must count each line of a file once.
  async scan(
    sessions: ReadonlyMap<string, SessionFiles>,
    onAdded?: (delta: TranscriptDelta) => void
  ): Promise<void> {
    this.sessions = sessions
    const wanted = new Map<string, number | null>()
    const owners = new Map<string, string>()
    for (const [sessionKey, files] of sessions) {
      for (const path of [files.main, ...spawnedPaths(files)]) {
        wanted.set(path, null)
        owners.set(path, sessionKey)
      }
      for (const agent of files.agents) wanted.set(agent.path, agent.size)
    }
    for (const path of this.files.keys()) if (!wanted.has(path)) this.files.delete(path)
    for (const key of this.counted) if (!sessions.has(key)) this.counted.delete(key)

    let remaining = this.budgetBytes
    this.behind = false
    this.failed = false
    for (const [path, knownSize] of wanted) {
      try {
        const size = knownSize ?? (await this.io.stat(path)).size
        const sessionKey = owners.get(path)
        const report =
          onAdded && sessionKey !== undefined
            ? (increment: UsageIncrement): void => onAdded({ sessionKey, file: path, ...increment })
            : undefined
        remaining -= await this.advance(path, size, remaining, report)
      } catch (error) {
        this.files.delete(path)
        if (!isMissing(error)) this.failed = true
      }
    }
    for (const [key, files] of sessions) {
      if (!this.files.has(files.main)) this.counted.delete(key)
      // A sidecar that vanished or cannot be read holds nothing back; health reports the failure.
      else if (
        [files.main, ...spawnedPaths(files)].every(
          (path) => this.files.get(path)?.hasReachedEnd !== false
        )
      )
        this.counted.add(key)
    }
  }

  private async advance(
    path: string,
    size: number,
    budget: number,
    report?: (increment: UsageIncrement) => void
  ): Promise<number> {
    let file = this.files.get(path)
    // A file shorter than what was read was rewritten: count it again from the start.
    if (!file || size < file.offset) file = { offset: 0, fold: emptyFold(), hasReachedEnd: false }
    this.files.set(path, file)
    let spent = 0
    while (file.offset < size) {
      const window = Math.min(this.chunkBytes, budget - spent)
      if (window <= 0) {
        this.behind = true
        return spent
      }
      const read = await this.io.readFrom(path, file.offset, window)
      if (read.nextOffset > file.offset) {
        file.fold = foldLines(file.fold, read.text, report)
        spent += read.nextOffset - file.offset
        file.offset = read.nextOffset
        continue
      }
      // No whole line in the window: the half-written last line, which waits for its newline.
      if (size - file.offset <= window) break
      if (window < this.chunkBytes) {
        this.behind = true
        return spent
      }
      // A line longer than a full read is skipped; what is left of it will not parse.
      file.offset += window
      spent += window
    }
    file.hasReachedEnd = true
    return spent
  }

  // null until every transcript of the session has been read to its end once.
  usage(key: string): SessionUsage | null {
    const files = this.sessions.get(key)
    const main = files && this.files.get(files.main)
    if (!files || !main || !this.counted.has(key)) return null
    const spawned = spawnedPaths(files)
    return {
      own: foldTotal(main.fold),
      subagents: this.tokens(spawned) ?? zeroCounts(),
      spawned: spawned.length,
      contextTokens: contextTokens(main.fold),
      contextLimit: null
    }
  }

  // What these transcripts spent together; null when none of them is being counted.
  tokens(paths: string[]): TokenCounts | null {
    const folds = paths.flatMap((path) => this.files.get(path)?.fold ?? [])
    return folds.length
      ? folds.reduce((sum, fold) => addCounts(sum, foldTotal(fold)), zeroCounts())
      : null
  }

  // The session with its counters and each live agent's own; all unknown until it is counted.
  fill(session: SessionRef): SessionRef {
    const usage = this.usage(session.key)
    const files = this.sessions.get(session.key)
    const paths = new Map<string, string[]>([
      ...(files?.agents ?? []).map((agent): [string, string[]] => [agent.id, [agent.path]]),
      ...(files?.teammates ?? [])
    ])
    return {
      ...session,
      usage,
      subagents: session.subagents.map((agent) => ({
        ...agent,
        tokens: usage ? this.tokens(paths.get(agent.id) ?? []) : null
      }))
    }
  }

  // True until a scan has read every transcript to its end within the byte budget.
  get isBehind(): boolean {
    return this.behind
  }

  health(): SourceHealth {
    if (this.failed) return { id: 'usage', ok: false, detail: 'transcript read failed' }
    return { id: 'usage', ok: true, detail: this.behind ? 'counting' : 'counted' }
  }
}
