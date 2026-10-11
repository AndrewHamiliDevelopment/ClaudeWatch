import { describe, expect, it } from 'vitest'
import { buildLayout } from './layout'
import { session } from './fixtures'
import { placements } from './placements'

const many = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    ...session(`s${String(i).padStart(3, '0')}`, `p_${i % 12}`),
    companyKey: `c_${i % 4}`,
    companyLabel: `Company ${i % 4}`
  }))

describe('nested headquarters layout', () => {
  it('is deterministic for 60 sessions in 12 projects and four companies', () => {
    const sessions = many(60)
    const layout = buildLayout(sessions, undefined, 0)
    expect(layout).toEqual(buildLayout([...sessions].reverse(), undefined, 0))
    expect(layout.floors).toHaveLength(1)
    expect(layout.floors[0].id).toBe('hq')
    expect(layout.floors[0].zones).toHaveLength(4)
    expect(layout.floors[0].zones.flatMap((c) => c.children)).toHaveLength(12)
    expect(layout.floors[0].rooms.filter((r) => r.sessionKey)).toHaveLength(60)
  })
  it('keeps existing desks and zones fixed across additions, removals and reloads', () => {
    const saved = buildLayout([session('b')], undefined, 0)
    const before = JSON.stringify(saved)
    const next = buildLayout([session('a'), session('b')], saved, 1)
    expect(next.reservations.b).toEqual(saved.reservations.b)
    expect(next.floors[0].rooms.find((r) => r.sessionKey === 'b')).toEqual(saved.floors[0].rooms[0])
    expect(next.floors[0].zones[0].x).toBe(saved.floors[0].zones[0].x)
    expect(JSON.stringify(saved)).toBe(before)
    const removed = buildLayout([session('b')], next, 2)
    expect(buildLayout([session('a'), session('b')], removed, 3).reservations.a).toEqual(
      next.reservations.a
    )
  })
  it('reserves in steps of four and grows without moving existing offices', () => {
    const initial = buildLayout([session('a')], undefined, 0)
    const expanded = buildLayout(
      Array.from({ length: 9 }, (_, i) => session(i ? `b${i}` : 'a')),
      initial,
      1
    )
    expect(initial.floors[0].zones[0].children[0].capacity).toBe(4)
    expect(expanded.floors[0].zones[0].children[0].capacity).toBe(12)
    expect(expanded.floors[0].rooms.find((r) => r.sessionKey === 'a')).toEqual(
      initial.floors[0].rooms[0]
    )
  })
  it('prunes empty projects and companies after exactly 24 hours', () => {
    const saved = buildLayout([session('a'), session('b', 'p_b')], undefined, 0)
    const removed = buildLayout([session('b', 'p_b')], saved, 100)
    expect(
      buildLayout([session('b', 'p_b')], removed, 86400099).floors[0].zones[0].children
    ).toHaveLength(2)
    expect(
      buildLayout([session('b', 'p_b')], removed, 86400100).floors[0].zones[0].children
    ).toHaveLength(1)
    const empty = buildLayout([], saved, 100)
    const pruned = buildLayout([], empty, 86400100)
    expect(pruned.floors[0].zones).toEqual([])
    expect(pruned.reservations).toEqual({})
  })
  it('keeps two guests at their parent and allocates overflow per project', () => {
    const sessions = ['p_a', 'p_b'].map((p) => ({
      ...session(p, p),
      subagents: Array.from({ length: 17 }, (_, i) => ({
        id: String(i),
        type: 'worker',
        activity: 'reading' as const
      }))
    }))
    const layout = buildLayout(sessions, undefined, 0)
    const agents = placements(sessions, layout)
    expect(agents.filter((p) => p.slot.id.startsWith('desk_guest'))).toHaveLength(4)
    expect(agents.filter((p) => p.room.kind === 'team')).toHaveLength(30)
    for (const agent of agents) expect(agent.room.projectKey).toBe(agent.session.projectKey)
    expect(new Set(agents.map((p) => `${p.room.id}:${p.slot.id}`)).size).toBe(36)
  })
})

it('keeps projects fixed when a lexically earlier project arrives', () => {
  const saved = buildLayout([session('z', 'p_z')], undefined, 0)
  const next = buildLayout([session('z', 'p_z'), session('a', 'p_a')], saved, 1)
  expect(next.floors[0].rooms.find((r) => r.sessionKey === 'z')).toEqual(
    saved.floors[0].rooms.find((r) => r.sessionKey === 'z')
  )
  const projects = next.floors[0].zones[0].children
  expect(projects[0].x === projects[1].x && projects[0].z === projects[1].z).toBe(false)
})

it('grows a busy project in place without repacking a free neighbouring column', () => {
  const sessions = [session('a', 'p_a'), session('b', 'p_b'), session('c', 'p_c')]
  const saved = buildLayout(sessions, undefined, 0)
  const grown = buildLayout(
    [...sessions, ...Array.from({ length: 20 }, (_, i) => session(`new${i}`, 'p_b'))],
    saved,
    1
  )
  expect(grown.floors[0].rooms.find((r) => r.sessionKey === 'c')).toEqual(
    saved.floors[0].rooms.find((r) => r.sessionKey === 'c')
  )
})

it('keeps every project inside its company after growth and pruning a slot', () => {
  const sessions = Array.from({ length: 7 }, (_, i) => session(`s${i}`, `p_${i}`))
  const saved = buildLayout(sessions, undefined, 0)
  const removed = buildLayout(sessions.slice(1), saved, 1)
  const pruned = buildLayout(sessions.slice(1), removed, 86400001)
  const grown = buildLayout(
    [
      ...sessions.slice(1),
      session('new', 'p_new'),
      ...Array.from({ length: 30 }, (_, i) => session(`busy${i}`, 'p_3'))
    ],
    pruned,
    86400002
  )
  const company = grown.floors[0].zones[0]
  for (const project of company.children) {
    expect(Math.abs(project.x - company.x) + project.width / 2).toBeLessThanOrEqual(
      company.width / 2
    )
    expect(Math.abs(project.z - company.z) + project.depth / 2).toBeLessThanOrEqual(
      company.depth / 2
    )
  }
})
