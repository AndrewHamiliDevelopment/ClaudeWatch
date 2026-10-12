import type { PartSpec } from '../parts'

export function scaled(parts: readonly PartSpec[], factor: number, lift = 0): PartSpec[] {
  return parts.map((part) => ({
    ...part,
    at: [part.at[0] * factor, part.at[1] * factor + lift, part.at[2] * factor],
    size: [part.size[0] * factor, part.size[1] * factor, part.size[2] * factor]
  }))
}
