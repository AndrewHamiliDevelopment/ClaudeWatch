import { useMemo } from 'react'
import { Parts } from '../parts'
import type { LoungeProps } from '../types'
import { loungeParts } from './lounge-parts'

// The mess deck: stools at every seat, a games table, a simulator pod, a galley and a viewport.
export function GarrisonLounge({ lounge }: LoungeProps) {
  const parts = useMemo(() => loungeParts(lounge), [lounge])
  return (
    <group position={[lounge.x, 0, lounge.z]}>
      <Parts parts={parts} />
    </group>
  )
}
