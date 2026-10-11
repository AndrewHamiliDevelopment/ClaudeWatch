// How often the bridge polls while a window that draws its data is on screen.
export const LIVE_POLL_MS = 2000
// With none on screen only the accounts ledger listens, and it places tokens by the time
// each transcript line carries, so a slow poll loses nothing.
export const BACKGROUND_POLL_MS = 30_000

// What the host tells its bridge.
export interface PaceMessage {
  type: 'pace'
  intervalMs: number
}

// The interval a message from the host asks for, held to the two paces' range; null for
// anything that is not a pace message.
export function paceOf(message: unknown): number | null {
  if (typeof message !== 'object' || message === null) return null
  if (!('type' in message) || message.type !== 'pace' || !('intervalMs' in message)) return null
  const { intervalMs } = message
  if (typeof intervalMs !== 'number' || !Number.isFinite(intervalMs)) return null
  return Math.min(Math.max(intervalMs, LIVE_POLL_MS), BACKGROUND_POLL_MS)
}
