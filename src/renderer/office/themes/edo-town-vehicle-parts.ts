import { wheel as figureWheel, type FigurePart } from '../citizens/figure-parts'

interface Wheel {
  color: string
  across: number
  radius: number
  along: number
}

export function vehicleWheel({ color, across, radius, along }: Wheel): FigurePart {
  const wheel = figureWheel(color, radius, 0.09, [0, 0, 0])
  wheel.geometry.computeBoundingBox()
  // Seven-sided wheels do not reach the nominal radius at their lowest vertex.
  const bottom = wheel.geometry.boundingBox?.min.y ?? -radius
  wheel.geometry.translate(across, -bottom, along)
  return wheel
}

export function vehicleWheels({
  color,
  across,
  radius,
  axles
}: Omit<Wheel, 'along'> & {
  axles: readonly number[]
}): FigurePart[] {
  return [-1, 1].flatMap((side) =>
    axles.map((along) => vehicleWheel({ color, across: side * across, radius, along }))
  )
}
