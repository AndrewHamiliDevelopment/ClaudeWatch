import type { FeedMessage, OfficeSnapshot } from './types'

// Folds the bridge's feed into the latest snapshot. Returns null when there is no
// trustworthy state (before the first hello, or after a resync request).
export function applyFeed(
  current: OfficeSnapshot | null,
  message: FeedMessage
): OfficeSnapshot | null {
  if (message.type === 'hello') return message.snapshot
  if (message.type === 'resync' || current === null) return null

  const removed = new Set(message.removed)
  const upserts = new Map(message.upserts.map((session) => [session.key, session]))
  const kept = current.sessions
    .filter((session) => !removed.has(session.key))
    .map((session) => upserts.get(session.key) ?? session)
  const keptKeys = new Set(kept.map((session) => session.key))
  const added = message.upserts.filter((session) => !keptKeys.has(session.key))

  return { ...current, rev: message.seq, sessions: [...kept, ...added] }
}
