import { needsHuman, type HumanAttention } from '../../../shared/office/attention'
import type { SessionRef } from '../../../shared/office/types'

export interface AttentionItem {
  sessionKey: string
  attention: HumanAttention
  sessionName: string
  projectLabel: string
  companyLabel: string
  sinceMs: number
}

function isQueued(session: SessionRef): session is SessionRef & { attention: HumanAttention } {
  return needsHuman(session.attention)
}

// Only "needs you" states queue (research §14); error and limited are counts, not queue items.
// updatedAtMs stands in for "waiting since": a session blocked on the human does not update.
export function buildAttentionQueue(sessions: readonly SessionRef[]): AttentionItem[] {
  return sessions
    .filter(isQueued)
    .map((session) => ({
      sessionKey: session.key,
      attention: session.attention,
      sessionName: session.name,
      projectLabel: session.projectLabel,
      companyLabel: session.companyLabel,
      sinceMs: session.updatedAtMs
    }))
    .sort((a, b) => a.sinceMs - b.sinceMs || a.sessionKey.localeCompare(b.sessionKey))
}

export function nextAttentionKey(
  queue: readonly AttentionItem[],
  currentKey: string | null
): string | null {
  if (queue.length === 0) return null
  const index = queue.findIndex((item) => item.sessionKey === currentKey)
  return queue[(index + 1) % queue.length].sessionKey
}

export function newAttentionItems(
  previous: readonly AttentionItem[],
  current: readonly AttentionItem[]
): AttentionItem[] {
  const seen = new Set(previous.map((item) => `${item.sessionKey}/${item.attention}`))
  return current.filter((item) => !seen.has(`${item.sessionKey}/${item.attention}`))
}
