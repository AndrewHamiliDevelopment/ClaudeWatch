import { useMemo } from 'react'
import { Batch } from '../primitives'
import { Parts } from '../parts'
import type { LoungeProps, SurroundingsProps } from '../types'
import { UNIT_SHAPES } from '../unit-parts'
import { baseYOf, buildLot } from './lots'
import { loungeParts } from './lounge-parts'
import type { PlacedPart } from './placed'

// One instanced mesh per shape and colour, however many lots there are: a few hundred lots are
// a few thousand parts, too many to mount as a mesh each.
export function PlacedParts({ parts }: { parts: readonly PlacedPart[] }) {
  const batches = useMemo(() => {
    const byLook = new Map<string, PlacedPart[]>()
    for (const part of parts) {
      const look = `${part.shape}:${part.color}:${part.glow}`
      const batch = byLook.get(look)
      if (batch) batch.push(part)
      else byLook.set(look, [part])
    }
    return [...byLook.entries()]
  }, [parts])
  return (
    <>
      {batches.map(([look, batch]) => (
        <Batch key={look} color={batch[0].color} glow={batch[0].glow} points={batch}>
          {UNIT_SHAPES[batch[0].shape]}
        </Batch>
      ))}
    </>
  )
}

// A spaceport yard on every lot: hangars, barracks, tank farms and towers, props along the walls.
export function GarrisonSurroundings({ floor, lots }: SurroundingsProps) {
  const parts = useMemo(
    () => lots.flatMap((lot) => buildLot(lot, baseYOf(lot, floor)).parts),
    [lots, floor]
  )
  return <PlacedParts parts={parts} />
}

// The mess deck: stools at every seat, a games table, a simulator pod, a galley and a viewport.
export function GarrisonLounge({ lounge }: LoungeProps) {
  const parts = useMemo(() => loungeParts(lounge), [lounge])
  return (
    <group position={[lounge.x, 0, lounge.z]}>
      <Parts parts={parts} />
    </group>
  )
}
