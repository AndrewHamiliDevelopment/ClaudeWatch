// A count, a time or a percentage read from outside this process: finite and never negative.
export const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

export const amountOrNull = (value: unknown): number | null => (isAmount(value) ? value : null)
