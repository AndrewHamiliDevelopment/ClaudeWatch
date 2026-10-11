import { useCallback, useEffect, useRef, useState } from 'react'
import type { InteractionResult } from '../../../shared/office/types'

export type RequestState<T extends InteractionResult> =
  | { status: 'idle' }
  | { status: 'pending' }
  | { status: 'done'; result: T }

// One in-flight request per panel. A rejected promise (bridge torn down) becomes the fallback
// failure, and results that land after unmount are dropped.
export function useRequest<T extends InteractionResult>(
  fallback: T
): [RequestState<T>, (request: () => Promise<T>) => Promise<T>] {
  const [state, setState] = useState<RequestState<T>>({ status: 'idle' })
  const isMountedRef = useRef(true)
  const fallbackRef = useRef(fallback)
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const run = useCallback(async (request: () => Promise<T>): Promise<T> => {
    setState({ status: 'pending' })
    const result = await request().catch(() => fallbackRef.current)
    if (isMountedRef.current) setState({ status: 'done', result })
    return result
  }, [])

  return [state, run]
}
