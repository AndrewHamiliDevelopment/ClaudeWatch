import { useState, useEffect } from 'react'
import type { ClaudeInstance, InstanceUpdate } from '../lib/types'

export function useInstances(): ClaudeInstance[] {
  const [instances, setInstances] = useState<ClaudeInstance[]>([])

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return

    const apply = (update: InstanceUpdate): void => setInstances(update.instances)
    window.api.getInstances().then(apply)
    return window.api.onInstancesUpdate(apply)
  }, [])

  return instances
}
