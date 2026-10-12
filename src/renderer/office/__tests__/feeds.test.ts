import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFixtureFrame, createFixtureFeed, FIXTURE_TICK_MS } from '../fixture/fixture-feed'
import { fixtureLayout } from '../fixture/fixture-layout'
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

describe('fixture layout memory', () => {
  const sessions = buildFixtureFrame(0, 1_000_000).sessions
  // Drop the first session of the busiest project, as when an agent finishes.
  const busiest = sessions
    .map((session) => session.projectKey)
    .sort(
      (a, b) =>
        sessions.filter((session) => session.projectKey === b).length -
        sessions.filter((session) => session.projectKey === a).length
    )[0]
  const leaver = sessions.find((session) => session.projectKey === busiest)
  const remaining = sessions.filter((session) => session !== leaver)
  const roomOf = (floors: OfficeFrame['floors'], sessionKey: string) =>
    floors[0].rooms.find((room) => room.sessionKey === sessionKey)

  it('keeps the remaining offices in place when a session leaves, given the saved layout', () => {
    const before = fixtureLayout(sessions)
    const after = fixtureLayout(remaining, before.layout)
    for (const session of remaining) {
      const was = roomOf(before.floors, session.key)
      const now = roomOf(after.floors, session.key)
      expect([session.name, now?.x, now?.z]).toEqual([session.name, was?.x, was?.z])
    }
  })
})

describe('createFixtureFeed', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('emits a frame on the first sim tick and keeps ticking until unsubscribed', () => {
    const feed = createFixtureFeed({ tickMs: 1000 })
    const listener = vi.fn()
    const unsubscribe = feed.subscribe(listener)
    vi.advanceTimersByTime(100)
    expect(listener).toHaveBeenCalledTimes(1)
    // Each scripted tick brings a new frame; walking agents add more in between.
    vi.advanceTimersByTime(3000)
    const emitted = listener.mock.calls.length
    expect(emitted).toBeGreaterThanOrEqual(4)
    unsubscribe()
    vi.advanceTimersByTime(3000)
    expect(listener).toHaveBeenCalledTimes(emitted)
  })
})
