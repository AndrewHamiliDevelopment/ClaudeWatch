import { expect, it } from 'vitest'
import { isJsonObject } from './json-object'

it('accepts an object and refuses null, arrays and primitives', () => {
  expect(isJsonObject({})).toBe(true)
  expect(isJsonObject({ hooks: [] })).toBe(true)
  for (const value of [null, undefined, [], [{}], 'text', 7, true]) {
    expect(isJsonObject(value)).toBe(false)
  }
})
