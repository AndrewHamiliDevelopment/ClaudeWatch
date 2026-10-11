import { expect, it } from 'vitest'
import { World } from './world'
import { session } from './fixtures'

function world() {
  const world = new World({ now: () => 0 })
  world.apply({
    type: 'hello',
    v: 1,
    snapshot: { rev: 0, generatedAtMs: 0, sessions: [session('a')], sources: [] }
  })
  return world
}
it('clamps a ten second delta to one second of walking', () => {
  const sim = world()
  const start = sim.step(0)[0]
  const end = sim.step(10000)[0]
  expect(Math.hypot(end.x - start.x, end.z - start.z)).toBeLessThanOrEqual(1.400001)
  expect(end.z).not.toBe(3.75)
})
it('leaves after removal and disappears at the elevator', () => {
  const sim = world()
  for (let i = 0; i < 100; i++) sim.step(100)
  sim.apply({ type: 'patch', v: 1, seq: 1, upserts: [], removed: ['a'] })
  expect(sim.step(0)).toHaveLength(1)
  for (let i = 0; i < 100; i++) sim.step(100)
  expect(sim.step(0)).toEqual([])
})
it('creates distinct subagent views', () => {
  const sim = new World({ now: () => 0 })
  const main = session('a')
  main.subagents = Array.from({ length: 6 }, (_, i) => ({
    id: String(i),
    type: 'worker',
    activity: 'reading'
  }))
  sim.apply({
    type: 'hello',
    v: 1,
    snapshot: { rev: 0, generatedAtMs: 0, sessions: [main], sources: [] }
  })
  const guests = sim.step(0).filter((a) => a.isSubagent)
  expect(guests).toHaveLength(6)
  expect(guests.map((a) => a.agentKey)).toContain('a#5')
  expect(guests.filter((a) => a.slotId.startsWith('team_seat'))).toHaveLength(2)
})

it('uses fixed ticks and protects returned layout data', () => {
  const sim = world()
  const start = sim.step(0)
  expect(sim.step(99)).toEqual(start)
  expect(sim.step(1)).not.toEqual(start)
  const layout = sim.layout()
  layout.floors.length = 0
  expect(sim.layout().floors).toHaveLength(1)
})
