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
  for (let i = 0; i < 1000; i++) sim.step(100)
  sim.apply({ type: 'patch', v: 1, seq: 1, upserts: [], removed: ['a'] })
  expect(sim.step(0)).toHaveLength(1)
  for (let i = 0; i < 1000; i++) sim.step(100)
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
  expect(guests.filter((a) => a.slotId.startsWith('team_seat'))).toHaveLength(4)
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

it('applies the bridge first seq=1 patch after hello rev=1, then rejects duplicates', () => {
  const sim = new World({ now: () => 0 })
  // BridgePoller.start emits the first tick (rev=1) before starting its seq counter at zero.
  sim.apply({
    type: 'hello',
    v: 1,
    snapshot: { rev: 1, generatedAtMs: 0, sessions: [session('a')], sources: [] }
  })
  expect(sim.revision()).toBe(1)
  sim.apply({
    type: 'patch',
    v: 1,
    seq: 1,
    upserts: [{ ...session('a'), attention: 'permission' }],
    removed: []
  })
  expect(sim.step(0)[0].attention).toBe('permission')
  sim.apply({ type: 'patch', v: 1, seq: 1, upserts: [session('a')], removed: [] })
  expect(sim.step(0)[0].attention).toBe('permission')
})

it('arrives from the same gate for all 60 agents across four companies', () => {
  const sim = new World({ now: () => 0 })
  const sessions = Array.from({ length: 60 }, (_, i) => ({
    ...session(`s${i}`, `p_${i % 12}`),
    companyKey: `c_${i % 4}`,
    companyLabel: `Company ${i % 4}`
  }))
  sim.apply({ type: 'hello', v: 1, snapshot: { rev: 1, generatedAtMs: 0, sessions, sources: [] } })
  expect(sim.step(0)).toHaveLength(60)
  for (const view of sim.step(0))
    expect({ x: view.x, z: view.z, floorId: view.floorId }).toEqual({ x: 0, z: 0, floorId: 'hq' })
})
it('keeps a subagent at its desk when a sibling finishes', () => {
  const sim = new World({ now: () => 0 })
  const worker = (id: string) => ({ id, type: 'worker', activity: 'reading' as const })
  const main = { ...session('a'), subagents: ['0', '1', '2'].map(worker) }
  sim.apply({
    type: 'hello',
    v: 1,
    snapshot: { rev: 0, generatedAtMs: 0, sessions: [main], sources: [] }
  })
  for (let i = 0; i < 1000; i++) sim.step(100)
  const before = sim.step(0).find((a) => a.agentKey === 'a#1')!
  expect(before.slotId).toBe('desk_guest_1')

  sim.apply({
    type: 'patch',
    v: 1,
    seq: 1,
    upserts: [{ ...main, subagents: ['1', '2'].map(worker) }],
    removed: []
  })
  const views = sim.step(0)
  const after = views.find((a) => a.agentKey === 'a#1')!
  expect(after).toMatchObject({ slotId: 'desk_guest_1', x: before.x, z: before.z })
  // The free guest desk goes to the subagent that was waiting in the team area.
  expect(views.find((a) => a.agentKey === 'a#2')!.slotId).toBe('desk_guest_0')
})
