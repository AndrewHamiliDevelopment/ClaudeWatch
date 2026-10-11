import type { TokenCounts } from './types'

export const zeroCounts = (): TokenCounts => ({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 })

export function addCounts(a: TokenCounts, b: TokenCounts): TokenCounts {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheWrite: a.cacheWrite + b.cacheWrite,
    cacheRead: a.cacheRead + b.cacheRead
  }
}

export function sumCounts(counts: TokenCounts): number {
  return counts.input + counts.output + counts.cacheWrite + counts.cacheRead
}
