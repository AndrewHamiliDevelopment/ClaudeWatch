import { useEffect, useState } from 'react'
import type { SessionRef } from '../../shared/office/types'
import { deckApi } from '../deck/deck-api'

const POLL_INTERVAL_MS = 3000

// The office feed's sessions, for what a process list cannot say: who waits on you, task
// names and tokens. Null means "unknown", so callers hide those parts instead of showing zero.
export function useAgentSessions(): SessionRef[] | null {
  const [sessions, setSessions] = useState<SessionRef[] | null>(null)

  useEffect(() => {
    const getOfficeSnapshot = deckApi()?.getOfficeSnapshot
    if (!getOfficeSnapshot) return

    let isMounted = true
    // The dashboard and the popover spend most of their life hidden; neither polls then.
    const read = async (): Promise<void> => {
      if (document.hidden) return
      try {
        const snapshot = await getOfficeSnapshot()
        if (isMounted && snapshot) setSessions(snapshot.sessions)
      } catch {
        // One failed read keeps the last known sessions; the next poll retries.
      }
    }
    void read()
    const timer = setInterval(read, POLL_INTERVAL_MS)
    document.addEventListener('visibilitychange', read)
    return () => {
      isMounted = false
      clearInterval(timer)
      document.removeEventListener('visibilitychange', read)
    }
  }, [])

  return sessions
}
