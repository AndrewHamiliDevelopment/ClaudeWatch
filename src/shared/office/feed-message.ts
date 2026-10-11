import type { FeedMessage } from './types'

// The envelope only: a known type and, for state-carrying messages, the protocol version.
export function isFeedMessage(data: unknown): data is FeedMessage {
  if (typeof data !== 'object' || data === null || !('type' in data)) return false
  if (data.type === 'resync') return true
  return (data.type === 'hello' || data.type === 'patch') && 'v' in data && data.v === 1
}
