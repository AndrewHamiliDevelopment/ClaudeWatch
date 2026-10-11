import { describe, expect, it } from 'vitest'
import { addCounts, sumCounts, zeroCounts } from './token-counts'

const counts = { input: 1, output: 2, cacheWrite: 30, cacheRead: 400 }

describe('token counts', () => {
  it('starts every part at zero, in a fresh object each time', () => {
    expect(zeroCounts()).toEqual({ input: 0, output: 0, cacheWrite: 0, cacheRead: 0 })
    expect(zeroCounts()).not.toBe(zeroCounts())
  })

  it('adds part by part without touching either side', () => {
    const other = { input: 10, output: 20, cacheWrite: 300, cacheRead: 4000 }
    expect(addCounts(counts, other)).toEqual({
      input: 11,
      output: 22,
      cacheWrite: 330,
      cacheRead: 4400
    })
    expect(counts.input).toBe(1)
  })

  it('sums the four parts into one total', () => {
    expect(sumCounts(counts)).toBe(433)
    expect(sumCounts(zeroCounts())).toBe(0)
  })
})
