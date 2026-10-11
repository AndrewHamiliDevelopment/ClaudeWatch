import { expect, it } from 'vitest'
import { UsageThrottle } from './usage-throttle'
import { session } from './__fixtures__/helpers'
import type { SessionRef, SessionUsage, TokenCounts } from '../shared/office/types'

const counts = (output: number): TokenCounts => ({
  input: 0,
  output,
  cacheWrite: 0,
  cacheRead: 0
})
const usage = (output: number): SessionUsage => ({
  own: counts(output),
  subagents: counts(0),
  spawned: 0,
  contextTokens: null,
  contextLimit: null
})
function ref(output: number | null, agents: Record<string, number> = {}): SessionRef {
  return {
    ...session('a'),
    usage: output === null ? null : usage(output),
    subagents: Object.entries(agents).map(([id, tokens]) => ({
      id,
      type: 'worker',
      activity: 'thinking',
      tokens: counts(tokens)
    }))
  }
}
const shown = (value: SessionRef) => [
  value.usage?.own.output ?? null,
  ...value.subagents.map((agent) => agent.tokens?.output ?? null)
]

it('lets a session’s numbers change at most once every ten seconds', () => {
  const throttle = new UsageThrottle()
  expect(shown(throttle.apply(ref(1, { x: 1 }), 0))).toEqual([1, 1])
  expect(shown(throttle.apply(ref(2, { x: 2 }), 2000))).toEqual([1, 1])
  expect(shown(throttle.apply(ref(3, { x: 3 }), 9999))).toEqual([1, 1])
  expect(shown(throttle.apply(ref(4, { x: 4 }), 10000))).toEqual([4, 4])
  expect(shown(throttle.apply(ref(5, { x: 5 }), 12000))).toEqual([4, 4])
})

it('shows the first numbers at once, however recently the session appeared', () => {
  const throttle = new UsageThrottle()
  expect(shown(throttle.apply(ref(null), 0))).toEqual([null])
  expect(shown(throttle.apply(ref(7), 2000))).toEqual([7])
  expect(shown(throttle.apply(ref(8), 4000))).toEqual([7])
})

it('does not start the wait over while nothing changes', () => {
  const throttle = new UsageThrottle()
  throttle.apply(ref(1), 0)
  throttle.apply(ref(1), 30000)
  expect(shown(throttle.apply(ref(2), 32000))).toEqual([2])
})

it('gives an agent that arrives mid-wait its numbers, then holds them like the rest', () => {
  const throttle = new UsageThrottle()
  throttle.apply(ref(1, { x: 1 }), 0)
  expect(shown(throttle.apply(ref(2, { x: 2, y: 50 }), 2000))).toEqual([1, 1, 50])
  expect(shown(throttle.apply(ref(3, { y: 60 }), 4000))).toEqual([1, 50])
  expect(shown(throttle.apply(ref(3, { y: 60 }), 10000))).toEqual([3, 60])
})

it('forgets sessions that left', () => {
  const throttle = new UsageThrottle()
  throttle.apply(ref(1), 0)
  throttle.prune(new Set())
  expect(shown(throttle.apply(ref(2), 2000))).toEqual([2])
})

it('changes nothing but the numbers', () => {
  const throttle = new UsageThrottle()
  throttle.apply(ref(1, { x: 1 }), 0)
  const later = { ...ref(2, { x: 2 }), activity: 'reading' as const }
  const held = throttle.apply(later, 2000)
  expect({ ...held, usage: later.usage, subagents: later.subagents }).toEqual(later)
  expect(held.subagents[0]).toMatchObject({ id: 'x', type: 'worker', activity: 'thinking' })
})
