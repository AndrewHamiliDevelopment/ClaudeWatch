import type { InstancePlacement } from '../../scene/instancing'
import type { PartSpec } from '../parts'
import type { UnitShape } from '../unit-parts'

// A part in floor coordinates, ready to be one instance of its shape and colour.
export interface PlacedPart extends Required<InstancePlacement> {
  shape: UnitShape
  color: string
  glow: boolean
}

interface Anchor {
  x: number
  y: number
  z: number
  scale: number
  // Quarter turns about the vertical: all an instance can carry, and all a square lot needs.
  turns: number
}

export function scaled(parts: readonly PartSpec[], factor: number, lift = 0): PartSpec[] {
  return parts.map((part) => ({
    ...part,
    at: [part.at[0] * factor, part.at[1] * factor + lift, part.at[2] * factor],
    size: [part.size[0] * factor, part.size[1] * factor, part.size[2] * factor]
  }))
}

export function place(parts: readonly PartSpec[], anchor: Anchor): PlacedPart[] {
  const angle = (anchor.turns * Math.PI) / 2
  const cos = Math.round(Math.cos(angle))
  const sin = Math.round(Math.sin(angle))
  return parts.map((part) => ({
    shape: part.shape,
    color: part.color,
    glow: part.glow === true,
    x: anchor.x + (part.at[0] * cos + part.at[2] * sin) * anchor.scale,
    y: anchor.y + part.at[1] * anchor.scale,
    z: anchor.z + (part.at[2] * cos - part.at[0] * sin) * anchor.scale,
    rotationY: angle,
    scaleX: part.size[0] * anchor.scale,
    scaleY: part.size[1] * anchor.scale,
    scaleZ: part.size[2] * anchor.scale
  }))
}
