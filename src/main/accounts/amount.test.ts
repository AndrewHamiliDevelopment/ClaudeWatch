import { expect, it } from 'vitest'
import { amountOrNull, isAmount, toCounts } from './amount'

it('reads token counts only when all four are amounts, and keeps nothing else beside them', () => {
  const counts = { input: 1, output: 2, cacheWrite: 0, cacheRead: 4 }
  expect(toCounts({ ...counts, text: 'CANARY' })).toEqual(counts)
  for (const value of [null, 'counts', { ...counts, input: -1 }, { input: 1, output: 2 }]) {
    expect(toCounts(value)).toBeNull()
  }
})

it('accepts zero and positive finite numbers only', () => {
  expect([0, 1.5, 7].every(isAmount)).toBe(true)
  for (const value of [-1, Number.NaN, Infinity, '7', null, undefined]) {
    expect(isAmount(value)).toBe(false)
  }
})

it('turns anything that is not an amount into null', () => {
  expect(amountOrNull(12)).toBe(12)
  expect(amountOrNull(-12)).toBeNull()
  expect(amountOrNull('12')).toBeNull()
})
