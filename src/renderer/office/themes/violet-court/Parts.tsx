import type { Vector } from '../primitives'
import { UnitPart, type UnitShape } from '../unit-parts'

// A figure as data: unit shapes scaled per part, so a whole cast shares a few merged draws.
export interface PartSpec {
  shape: UnitShape
  at: Vector
  size: Vector
  color: string
  rotation?: Vector
  glow?: boolean
}

export const box = (at: Vector, size: Vector, color: string): PartSpec => ({
  shape: 'box',
  at,
  size,
  color
})

export const turned = (part: PartSpec, rotation: Vector): PartSpec => ({ ...part, rotation })

export function Parts({ parts }: { parts: readonly PartSpec[] }) {
  return (
    <>
      {parts.map((part, index) => (
        <UnitPart key={index} {...part} />
      ))}
    </>
  )
}
