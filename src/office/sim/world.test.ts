import { expect, it } from 'vitest'
import { World } from './world'
import { session } from './fixtures'

// An office that was open and empty when session `a` started, so `a` walks in.
function world() {
  const world = new World({ now: () => 0 })
  world.apply({
    type: 'hello',
    v: 1,
    snapshot: { rev: 0, generatedAtMs: 0, sessions: [], sources: [] }
  })
  world.apply({ type: 'patch', v: 1, seq: 1, upserts: [session('a')], removed: [] })
  return world
}
it('seats the sessions that were already running when the office opens', () => {
  const sim = new World({ now: () => 0 })
  sim.apply({
    type: 'hello',
    v: 1,
    snapshot: { rev: 1, generatedAtMs: 0, sessions: [session('a')], sources: [] }
  })
  const [seated] = sim.step(0)
  const seat = sim
    .layout()
    .floors[0].rooms.find((r) => r.sessionKey === 'a')!
    .slots.find((s) => s.id === 'desk_main')!
  expect(seated).toMatchObject({ x: seat.x, z: seat.z, heading: seat.heading })

  // A session that starts while the office is open walks in from the gate.
  sim.apply({ type: 'patch', v: 1, seq: 2, upserts: [session('b')], removed: [] })
  expect(sim.step(0).find((a) => a.agentKey === 'b')).toMatchObject({ x: 0, z: 0 })
})
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
  sim.apply({ type: 'patch', v: 1, seq: 2, upserts: [], removed: ['a'] })
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

it('applies the patch that follows the hello revision, then rejects duplicates and late ones', () => {
  const sim = new World({ now: () => 0 })
  // A patch's seq is the snapshot revision it produces, so it continues from the hello.
  sim.apply({
    type: 'hello',
    v: 1,
    snapshot: { rev: 1, generatedAtMs: 0, sessions: [session('a')], sources: [] }
  })
  expect(sim.revision()).toBe(1)
  sim.apply({
    type: 'patch',
    v: 1,
    seq: 2,
    upserts: [{ ...session('a'), attention: 'permission' }],
    removed: []
  })
  expect(sim.step(0)[0].attention).toBe('permission')
  for (const seq of [2, 1]) {
    sim.apply({ type: 'patch', v: 1, seq, upserts: [session('a')], removed: [] })
    expect(sim.step(0)[0].attention).toBe('permission')
  }
})

it('arrives from the same gate for all 60 agents across four companies', () => {
  const sim = new World({ now: () => 0 })
  const sessions = Array.from({ length: 60 }, (_, i) => ({
    ...session(`s${i}`, `p_${i % 12}`),
    companyKey: `c_${i % 4}`,
    companyLabel: `Company ${i % 4}`
  }))
  sim.apply({
    type: 'hello',
    v: 1,
    snapshot: { rev: 1, generatedAtMs: 0, sessions: [], sources: [] }
  })
  sim.apply({ type: 'patch', v: 1, seq: 2, upserts: sessions, removed: [] })
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

it('walks to a moved seat from where the agent is, not from the gate', () => {
  const sim = new World({ now: () => 0 })
  const worker = (id: string) => ({ id, type: 'worker', activity: 'reading' as const })
  const main = { ...session('a'), subagents: ['0', '1', '2'].map(worker) }
  sim.apply({
    type: 'hello',
    v: 1,
    snapshot: { rev: 1, generatedAtMs: 0, sessions: [main], sources: [] }
  })
  for (let i = 0; i < 1500; i++) sim.step(100)
  const before = sim.step(0).find((a) => a.agentKey === 'a#2')!
  expect(before.slotId).toBe('team_seat_0')

  // A fifth session grows the project by a row, which pushes the team area down.
  const more = ['b', 'c', 'd', 'e'].map((key) => session(key))
  sim.apply({ type: 'patch', v: 1, seq: 2, upserts: more, removed: [] })
  const after = sim.step(0).find((a) => a.agentKey === 'a#2')!
  expect(sim.layout().floors[0].rooms.find((r) => r.id === after.roomId)!.z).toBeGreaterThan(
    before.z
  )
  expect({ x: after.x, z: after.z }).toEqual({ x: before.x, z: before.z })
})
it('keeps a team-area sitter in place when a new office is built over its old seat', () => {
  const sim = new World({ now: () => 0 })
  const worker = (id: string) => ({ id: `s${id}`, type: 'worker', activity: 'reading' as const })
  const busy = { ...session('a'), subagents: ['0', '1', '2', '3'].map(worker) }
  sim.apply({
    type: 'hello',
    v: 1,
    snapshot: {
      rev: 1,
      generatedAtMs: 0,
      sessions: [busy, session('b'), session('c'), session('d')],
      sources: []
    }
  })
  const before = sim.step(0).find((a) => a.agentKey === 'a#s3')!
  sim.apply({ type: 'patch', v: 1, seq: 2, upserts: [session('e')], removed: [] })
  const after = sim.step(0).find((a) => a.agentKey === 'a#s3')!
  expect({ x: after.x, z: after.z }).toEqual({ x: before.x, z: before.z })
})
it('brings a new arrival to rest exactly on its seat', () => {
  const sim = world()
  for (let i = 0; i < 2000; i++) sim.step(100)
  const [arrived] = sim.step(0)
  const seat = sim
    .layout()
    .floors[0].rooms.find((r) => r.sessionKey === 'a')!
    .slots.find((s) => s.id === 'desk_main')!
  expect({ x: arrived.x, z: arrived.z }).toEqual({ x: seat.x, z: seat.z })
})
