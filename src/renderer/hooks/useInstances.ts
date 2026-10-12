import { useState, useEffect } from 'react'
import { deckApi } from '../deck/deck-api'
import type { ClaudeInstance, InstanceUpdate } from '../lib/types'

export function useInstances(): ClaudeInstance[] {
  const [instances, setInstances] = useState<ClaudeInstance[]>([])

  useEffect(() => {
    const api = deckApi()
    if (!api) return

    const apply = (update: InstanceUpdate): void => setInstances(update.instances)
    api.getInstances().then(apply)
    return api.onInstancesUpdate(apply)
  }, [])

  return instances
}
