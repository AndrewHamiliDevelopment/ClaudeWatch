import { expect, it } from 'vitest'
import { amountOrNull, isAmount } from './amount'

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
