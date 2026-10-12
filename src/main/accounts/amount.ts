import { object } from '../../bridge/io'
import type { TokenCounts } from '../../shared/office/types'

// A count, a time or a percentage read from outside this process: finite and never negative.
export const isAmount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0

// A byte offset read from outside this process: a whole number no larger than a file gets.
export const isPosition = (value: unknown): value is number =>
  isAmount(value) && Number.isSafeInteger(value)

export const amountOrNull = (value: unknown): number | null => (isAmount(value) ? value : null)

// Token counts read from outside this process: all four amounts, or nothing.
export function toCounts(value: unknown): TokenCounts | null {
  const counts = object(value)
  if (!counts) return null
  const { input, output, cacheWrite, cacheRead } = counts
  return isAmount(input) && isAmount(output) && isAmount(cacheWrite) && isAmount(cacheRead)
    ? { input, output, cacheWrite, cacheRead }
    : null
}
