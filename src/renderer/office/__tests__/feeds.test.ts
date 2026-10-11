import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFixtureFrame, createFixtureFeed, FIXTURE_TICK_MS } from '../fixture/fixture-feed'
import type { OfficeFrame } from '../scene-model'

describe('buildFixtureFrame', () => {
  const frame = buildFixtureFrame(0, 1_000_000)

  it('puts every company, project and agent office on one floor', () => {
    expect(frame.floors).toHaveLength(1)
    const [floor] = frame.floors
    expect(floor.zones.length).toBeGreaterThanOrEqual(2)
    for (const company of floor.zones) {
      expect(company.kind).toBe('company')
      for (const project of company.children.filter((zone) => zone.kind === 'project')) {
        const offices = project.children.filter((zone) => zone.kind === 'office')
        expect(offices.length).toBeGreaterThan(0)
        expect(offices.length).toBeLessThanOrEqual(8)
      }
    }
  })

  it('includes a permission request and subagents', () => {
    expect(frame.sessions.some((session) => session.attention === 'permission')).toBe(true)
    expect(frame.agents.some((agent) => agent.isSubagent)).toBe(true)
  })

  it('places every agent in a room that exists on its floor', () => {
    for (const agent of frame.agents) {
      const floor = frame.floors.find((candidate) => candidate.floorId === agent.floorId)
      expect(floor?.rooms.some((room) => room.id === agent.roomId)).toBe(true)
    }
  })

  it('keeps a waiting session’s start time fixed while it keeps waiting', () => {
    const waitingAt = (tick: number) =>
      buildFixtureFrame(tick, 1_000_000 + tick * FIXTURE_TICK_MS).sessions.find(
        (session) => session.name === 'listing search'
      )
    const first = waitingAt(0)
    const later = waitingAt(4)
    expect(first?.attention).toBe('permission')
    expect(later?.attention).toBe('permission')
    expect(Number.isFinite(first?.updatedAtMs)).toBe(true)
    expect(later?.updatedAtMs).toBe(first?.updatedAtMs)
  })

  it('changes activities over time', () => {
    const later = buildFixtureFrame(7, 1_014_000)
    const activities = (snapshot: OfficeFrame) =>
      snapshot.sessions.map((session) => session.activity)
    expect(activities(later)).not.toEqual(activities(frame))
  })
})

describe('createFixtureFeed', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('emits a frame at once and keeps ticking until unsubscribed', () => {
    const feed = createFixtureFeed({ tickMs: 1000 })
    const listener = vi.fn()
    const unsubscribe = feed.subscribe(listener)
    expect(listener).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3000)
    expect(listener).toHaveBeenCalledTimes(4)
    unsubscribe()
    vi.advanceTimersByTime(3000)
    expect(listener).toHaveBeenCalledTimes(4)
  })
})
