import { describe, expect, it } from 'vitest'
import { buildLayout } from './layout'
import { session } from './fixtures'

describe('layout', () => {
  it('packs a large worktree wing before continuing on the next plate', () => {
    const sessions = Array.from({ length: 17 }, (_, i) => ({
      ...session(`s${i}`),
      worktree: '/wing'
    }))
    const layout = buildLayout(sessions, undefined, 0)
    expect(layout.floors[0].rooms.filter((r) => r.plate === 0)).toHaveLength(16)
    expect(layout.floors[0].rooms.filter((r) => r.plate === 1)).toHaveLength(1)
  })
  it('starts a wing on a new plate when the remaining bays cannot fit it', () => {
    const sessions = Array.from({ length: 17 }, (_, i) => ({
      ...session(`s${i}`),
      worktree: i < 14 ? '/a' : '/b'
    }))
    const layout = buildLayout(sessions, undefined, 0)
    const wing = sessions.slice(14).map((s) => layout.reservations[s.key])
    expect(wing.map((r) => r.plate)).toEqual([1, 1, 1])
    expect(wing.map((r) => r.bay).sort((a, b) => a - b)).toEqual([0, 1, 2])
  })
  it('is independent of input order across 60 sessions and 12 projects', () => {
    const sessions = Array.from({ length: 60 }, (_, i) => session(`s${i}`, `p_${i % 12}`))
    expect(buildLayout(sessions, undefined, 0)).toEqual(
      buildLayout(sessions.reverse(), undefined, 0)
    )
  })
  it('preserves saved rooms and does not mutate saved data', () => {
    const saved = buildLayout([session('b')], undefined, 0)
    const before = JSON.stringify(saved)
    const next = buildLayout([session('a'), session('b')], saved, 1)
    expect(next.reservations.b).toEqual(saved.reservations.b)
    expect(JSON.stringify(saved)).toBe(before)
  })
  it('reserves removed bays for 24 hours and reclaims restarted sessions', () => {
    const saved = buildLayout([session('a')], undefined, 0)
    const removed = buildLayout([], saved, 100)
    expect(buildLayout([session('a')], removed, 200).reservations.a.bay).toBe(0)
    expect(buildLayout([session('b')], removed, 200).reservations.b.bay).toBe(1)
    expect(buildLayout([session('b')], removed, 86400100).reservations.b.bay).toBe(0)
  })
  it('places four guests and two overflow subagents in a team room', () => {
    const main = session('a')
    main.subagents = Array.from({ length: 6 }, (_, i) => ({
      id: String(i),
      type: 'worker',
      activity: 'idle'
    }))
    const layout = buildLayout([main], undefined, 0)
    const rooms = layout.floors[0].rooms
    expect(
      rooms.find((r) => r.sessionKey === 'a')?.slots.filter((s) => s.id.startsWith('desk_guest'))
    ).toHaveLength(4)
    expect(
      rooms.find((r) => r.kind === 'team')?.slots.filter((s) => s.id.startsWith('team_seat'))
    ).toHaveLength(12)
  })
  it('keeps worktree wings contiguous and adds plates after sixteen rooms', () => {
    const sessions = Array.from({ length: 17 }, (_, i) => ({
      ...session(`s${i}`),
      worktree: i < 3 ? '/wing' : null
    }))
    const layout = buildLayout(sessions, undefined, 0)
    const wing = sessions
      .slice(0, 3)
      .map((s) => layout.reservations[s.key].bay)
      .sort((a, b) => a - b)
    expect(wing).toEqual([0, 1, 2])
    expect(layout.floors[0].rooms.some((r) => r.plate === 1)).toBe(true)
  })
})
