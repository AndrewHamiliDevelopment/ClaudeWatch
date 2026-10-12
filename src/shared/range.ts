export type Range = readonly [low: number, high: number]

export const clamp = (value: number, [low, high]: Range): number =>
  Math.min(Math.max(value, low), high)
