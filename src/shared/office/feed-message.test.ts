import { describe, expect, it } from 'vitest'
import { isFeedMessage } from './feed-message'

describe('isFeedMessage', () => {
  it.each([
    { type: 'resync' },
    { type: 'hello', v: 1, snapshot: {} },
    { type: 'patch', v: 1, seq: 2 }
  ])('accepts %j', (message) => {
    expect(isFeedMessage(message)).toBe(true)
  })

  it.each([
    null,
    'hello',
    7,
    {},
    { type: 'hello' },
    { type: 'patch', v: 2 },
    { type: 'other', v: 1 }
  ])('refuses %j', (message) => {
    expect(isFeedMessage(message)).toBe(false)
  })
})
