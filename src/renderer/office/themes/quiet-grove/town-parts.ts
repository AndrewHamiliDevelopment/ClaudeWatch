import { box, CORNERS, SIDES, sphere, turned, type PartSpec } from '../parts'
import type { Vector } from '../primitives'
import { GROVE } from './palette'

const ROOF_THICKNESS = 0.14

// A pitched roof whose ridge runs along x and tops out at `ridge[1]`: two slabs, each falling
// `rise` metres over `halfSpan`. Its pitch follows the room, so a low lot gets a low roof.
export function gable(
  ridge: Vector,
  length: number,
  halfSpan: number,
  rise: number,
  color: string
): PartSpec[] {
  const pitch = Math.atan2(rise, halfSpan)
  const middle = ridge[1] - rise / 2 - (ROOF_THICKNESS / 2) * Math.cos(pitch)
  return SIDES.map((side) =>
    turned(
      box(
        [ridge[0], middle, ridge[2] + (side * halfSpan) / 2],
        [length, ROOF_THICKNESS, Math.hypot(halfSpan, rise)],
        color
      ),
      [side * pitch, 0, 0]
    )
  )
}

// `count` places evenly round a circle, the first at the front.
export function ring(count: number, radius: number): { x: number; z: number }[] {
  return Array.from({ length: count }, (_, index) => {
    const angle = (index / count) * Math.PI * 2
    return { x: Math.sin(angle) * radius, z: Math.cos(angle) * radius }
  })
}

// A low mound of moss inside each corner of the plot.
export function cornerMoss(width: number, depth: number): PartSpec[] {
  return CORNERS.map(({ x, z }) =>
    sphere([x * (width / 2 - 0.5), 0.25, z * (depth / 2 - 0.5)], [0.8, 0.5, 0.8], GROVE.moss)
  )
}
