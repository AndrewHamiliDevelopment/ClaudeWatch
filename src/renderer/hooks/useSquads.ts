import { useMemo } from 'react'
import { buildSquads, type Squad } from '../deck/roster'
import { buildWorkOrders, type WorkOrder } from '../deck/work-orders'
import { useAgentSessions } from './useAgentSessions'
import { useInstances } from './useInstances'
import { useNow } from './useNow'

// How often "Done 4m ago" ages into "Idle" without waiting for a process poll.
const STATE_REFRESH_MS = 30_000

interface UseSquadsReturn {
  agentCount: number
  squads: Squad[]
  // Null while the office feed is unavailable and nobody can say who waits.
  workOrders: WorkOrder[] | null
}

// The roster and the work orders, derived once for the dashboard and for the popover.
export function useSquads(): UseSquadsReturn {
  const instances = useInstances()
  const sessions = useAgentSessions()
  const nowMs = useNow(STATE_REFRESH_MS)

  const squads = useMemo(
    () => buildSquads(instances, sessions, nowMs),
    [instances, sessions, nowMs]
  )
  const workOrders = useMemo(() => (sessions ? buildWorkOrders(sessions) : null), [sessions])

  return { agentCount: instances.length, squads, workOrders }
}
