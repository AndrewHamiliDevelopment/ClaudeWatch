import type { FeedMessage, OfficeSnapshot, SessionRef, SourceHealth } from '../shared/office/types'

export interface IngestBatch {
  now: number
  sessions: SessionRef[]
  sources: SourceHealth[]
}
export function emptySnapshot(): OfficeSnapshot {
  return { rev: 0, generatedAtMs: 0, sessions: [], sources: [] }
}
export function reduce(prev: OfficeSnapshot, batch: IngestBatch): OfficeSnapshot {
  const previous = new Map(prev.sessions.map((session) => [session.key, session]))
  const sessions = new Map<string, SessionRef>()
  for (const session of batch.sessions) {
    const old = previous.get(session.key)
    const recentlyFinished =
      session.activity === 'idle' &&
      old &&
      (old.activity !== 'idle' || old.attention === 'done') &&
      batch.now - session.updatedAtMs >= 0 &&
      batch.now - session.updatedAtMs < 120000
    sessions.set(
      session.key,
      recentlyFinished && session.attention === 'none'
        ? { ...session, attention: 'done' }
        : { ...session }
    )
  }
  return {
    rev: prev.rev + 1,
    generatedAtMs: batch.now,
    sessions: [...sessions.values()].sort((a, b) => a.key.localeCompare(b.key)),
    sources: batch.sources.map((source) => ({ ...source }))
  }
}
export function diff(
  prev: OfficeSnapshot,
  next: OfficeSnapshot,
  seq: number
): Extract<FeedMessage, { type: 'patch' }> {
  const old = new Map(prev.sessions.map((session) => [session.key, JSON.stringify(session)]))
  const keys = new Set(next.sessions.map((session) => session.key))
  return {
    type: 'patch',
    v: 1,
    seq,
    upserts: next.sessions.filter((session) => old.get(session.key) !== JSON.stringify(session)),
    removed: prev.sessions
      .filter((session) => !keys.has(session.key))
      .map((session) => session.key),
    ...(JSON.stringify(prev.sources) !== JSON.stringify(next.sources) && { sources: next.sources })
  }
}
