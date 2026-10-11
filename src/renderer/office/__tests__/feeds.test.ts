import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildFixtureFrame, createFixtureFeed, FIXTURE_TICK_MS } from '../fixture/fixture-feed'
import { createBridgeFeed, type OfficeBridge } from '../bridge-feed'
import type { OfficeFrame } from '../scene-model'

describe('buildFixtureFrame', () => {
  const frame = buildFixtureFrame(0, 1_000_000)

  it('animates 3 projects with up to 8 sessions each', () => {
    expect(frame.floors).toHaveLength(3)
    for (const floor of frame.floors) {
      const sessionRooms = floor.rooms.filter((room) => room.sessionKey !== null)
      expect(sessionRooms.length).toBeGreaterThan(0)
      expect(sessionRooms.length).toBeLessThanOrEqual(8)
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

describe('createBridgeFeed', () => {
  it('relays frames and jumps through the bridge', () => {
    const unsubscribe = vi.fn()
    const bridge: OfficeBridge = { onFeed: vi.fn(() => unsubscribe), jump: vi.fn() }
    const feed = createBridgeFeed(bridge)
    const listener = vi.fn()
    expect(feed.subscribe(listener)).toBe(unsubscribe)
    expect(bridge.onFeed).toHaveBeenCalledWith(listener)
    feed.jump('claude:a')
    expect(bridge.jump).toHaveBeenCalledWith('claude:a')
  })
})
