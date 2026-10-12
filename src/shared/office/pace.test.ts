import { expect, it } from 'vitest'
import { BACKGROUND_POLL_MS, LIVE_POLL_MS, paceOf } from './pace'

it('reads the interval a pace message asks for', () => {
  expect(paceOf({ type: 'pace', intervalMs: BACKGROUND_POLL_MS })).toBe(BACKGROUND_POLL_MS)
  expect(paceOf({ type: 'pace', intervalMs: LIVE_POLL_MS })).toBe(LIVE_POLL_MS)
})

it('never polls faster than live or slower than the background pace, whatever is asked', () => {
  expect(paceOf({ type: 'pace', intervalMs: 1 })).toBe(LIVE_POLL_MS)
  expect(paceOf({ type: 'pace', intervalMs: 86_400_000 })).toBe(BACKGROUND_POLL_MS)
})

it.each([
  null,
  'pace',
  { type: 'hello', intervalMs: 5000 },
  { type: 'pace' },
  { type: 'pace', intervalMs: '5000' },
  { type: 'pace', intervalMs: Number.NaN }
])('takes %j for no pace message', (message) => {
  expect(paceOf(message)).toBeNull()
})
