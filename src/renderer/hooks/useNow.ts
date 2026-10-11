import { useEffect, useState } from 'react'

// dry-new: office/hooks.ts has the same hook, but that module imports the 3D theme registry,
// which the dashboard bundle must not load.
export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}
