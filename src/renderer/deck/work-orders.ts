import type { SessionRef } from '../../shared/office/types'
import { buildAttentionQueue, type AttentionItem } from '../office/logic/attention-queue'
import type { JumpTarget } from './deck-api'

// The Office queue's own item plus where to jump, so an agent that needs you carries the
// same name, reason and action on the dashboard, the popover and the Office.
export interface WorkOrder extends AttentionItem {
  target: JumpTarget
}

export const WORK_ORDER_ACTION: Record<AttentionItem['attention'], string> = {
  permission: 'Review',
  question: 'Answer'
}

export function buildWorkOrders(sessions: readonly SessionRef[]): WorkOrder[] {
  const sessionByKey = new Map(sessions.map((session) => [session.key, session]))
  return buildAttentionQueue(sessions).flatMap((item) => {
    const session = sessionByKey.get(item.sessionKey)
    return session ? [{ ...item, target: { pid: session.pid, projectPath: session.cwd } }] : []
  })
}
