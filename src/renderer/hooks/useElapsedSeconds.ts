import { useEffect, useState } from 'react'
import type { ClaudeInstance } from '../lib/types'

// Counts on locally between polls, so the clock moves every second for a live process.
export function useElapsedSeconds(instance: ClaudeInstance): number {
  const [elapsedSeconds, setElapsedSeconds] = useState(instance.elapsedSeconds)

  useEffect(() => {
    setElapsedSeconds(instance.elapsedSeconds)
    if (instance.status === 'exited') return

    const timer = setInterval(() => setElapsedSeconds((seconds) => seconds + 1), 1000)
    return () => clearInterval(timer)
  }, [instance.elapsedSeconds, instance.status, instance.pid])

  return elapsedSeconds
}
