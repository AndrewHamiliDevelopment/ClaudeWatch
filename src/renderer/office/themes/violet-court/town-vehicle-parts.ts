import { tube, type FigurePart } from '../../citizens/figure-parts'

type Triple = readonly [number, number, number]

const WHEEL_WIDTH_M = 0.07

// A wheel on an axle across the vehicle: a tube stands along y, so it is laid over first.
export function wheel(color: string, radius: number, at: Triple): FigurePart {
  const part = tube(color, [radius, radius, WHEEL_WIDTH_M], [0, 0, 0])
  part.geometry.rotateZ(Math.PI / 2).translate(...at)
  return part
}

// A tube laid along the vehicle, nose to tail: a log, a shaft or a rolled cloth.
export function laid(color: string, radius: number, length: number, at: Triple): FigurePart {
  const part = tube(color, [radius, radius, length], [0, 0, 0])
  part.geometry.rotateX(Math.PI / 2).translate(...at)
  return part
}

// The same parts somewhere else: the animal in the shafts, the figure at the handles.
export function moved(parts: FigurePart[], by: Triple): FigurePart[] {
  for (const part of parts) part.geometry.translate(...by)
  return parts
}
