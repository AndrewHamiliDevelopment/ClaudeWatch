import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createLiveFeed, type FeedSource } from './live-feed'
import type { FeedMessage, SessionRef } from '../../shared/office/types'
import type { OfficeFrame } from '../office/scene-model'

const session = (key: string): SessionRef => ({
  key,
  provider: 'claude',
  sessionId: key,
  pid: 1,
  name: 'app',
  cwd: '/repo/app',
  projectKey: 'p_app',
  projectLabel: 'app',
  projectRoot: '/repo/app',
  companyKey: 'c_test',
  companyLabel: 'Test Co',
  worktree: null,
  host: 'terminal',
  orcaPaneKey: null,
  activity: 'editing',
  attention: 'none',
  currentTool: { name: 'Edit', category: 'edit' },
  subagents: [],
  startedAtMs: 1,
  updatedAtMs: 1
})

describe('createLiveFeed', () => {
  let listener: ((message: FeedMessage) => void) | null
  let source: FeedSource
  const storage = new Map<string, string>()
  const store = {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => void storage.set(key, value)
  }

  beforeEach(() => {
    vi.useFakeTimers()
    storage.clear()
    listener = null
    source = {
      ready: vi.fn().mockResolvedValue(undefined),
      onFeedMessage: vi.fn((next: (message: FeedMessage) => void) => {
        listener = next
        return () => {
          listener = null
        }
      }),
      jump: vi.fn().mockResolvedValue({ success: true }),
      send: vi.fn().mockResolvedValue({ success: true }),
      respond: vi.fn().mockResolvedValue({ success: true }),
      peek: vi.fn().mockResolvedValue({ success: true, lines: ['ok'] }),
      start: vi.fn().mockResolvedValue({ success: true })
    }
  })

  afterEach(() => vi.useRealTimers())

  it('asks for state once subscribed and emits frames with floors, agents and sessions', () => {
    const frames: OfficeFrame[] = []
    createLiveFeed(source, { storage: store }).subscribe((frame) => frames.push(frame))
    listener?.({
      type: 'hello',
      v: 1,
      snapshot: { rev: 1, generatedAtMs: 1, sessions: [session('claude:a')], sources: [] }
    })
    vi.advanceTimersByTime(300)

    expect(source.ready).toHaveBeenCalledOnce()
    const last = frames.at(-1)!
    expect(last.floors.map((f) => f.label)).toEqual(['app'])
    expect(last.sessions.map((s) => s.key)).toEqual(['claude:a'])
    expect(last.agents.map((a) => a.agentKey)).toEqual(['claude:a'])
  })

  it('persists the layout so desks stay put across restarts', () => {
    createLiveFeed(source, { storage: store }).subscribe(() => {})
    listener?.({
      type: 'hello',
      v: 1,
      snapshot: { rev: 1, generatedAtMs: 1, sessions: [session('claude:a')], sources: [] }
    })
    expect(JSON.parse(storage.get('claudewatch.office.layout')!).floors).toHaveLength(1)
  })

  it('stops ticking and unsubscribes from the bridge when the last listener leaves', () => {
    const frames: OfficeFrame[] = []
    const unsubscribe = createLiveFeed(source, { storage: store }).subscribe((frame) =>
      frames.push(frame)
    )
    unsubscribe()
    const count = frames.length
    vi.advanceTimersByTime(1_000)

    expect(frames).toHaveLength(count)
    expect(listener).toBeNull()
  })

  it('reports not connected until the first hello, then the bridge source health', () => {
    const frames: OfficeFrame[] = []
    createLiveFeed(source, { storage: store }).subscribe((frame) => frames.push(frame))
    vi.advanceTimersByTime(200)
    expect(frames.at(-1)).toMatchObject({ connected: false, sources: [] })
    const sources = [{ id: 'orca', ok: false, detail: 'Orca not running' }]
    listener?.({
      type: 'hello',
      v: 1,
      snapshot: { rev: 1, generatedAtMs: 1, sessions: [], sources }
    })
    vi.advanceTimersByTime(200)
    expect(frames.at(-1)).toMatchObject({ connected: true, sources })
  })

  it('emits only when the frame changed, not on every tick', () => {
    const frames: OfficeFrame[] = []
    createLiveFeed(source, { storage: store }).subscribe((frame) => frames.push(frame))
    listener?.({
      type: 'hello',
      v: 1,
      snapshot: { rev: 1, generatedAtMs: 1, sessions: [session('claude:a')], sources: [] }
    })
    // Robots walk from the arrival gate across the floor first; give them time to sit down.
    vi.advanceTimersByTime(300_000)
    const settled = frames.length
    vi.advanceTimersByTime(5_000)
    expect(frames).toHaveLength(settled)
  })

  it('does not rewrite the stored layout when it did not change', () => {
    const setItem = vi.spyOn(store, 'setItem')
    createLiveFeed(source, { storage: store }).subscribe(() => {})
    const hello: FeedMessage = {
      type: 'hello',
      v: 1,
      snapshot: { rev: 1, generatedAtMs: 1, sessions: [session('claude:a')], sources: [] }
    }
    listener?.(hello)
    listener?.({ ...hello, snapshot: { ...hello.snapshot, rev: 2 } })
    expect(setItem).toHaveBeenCalledTimes(1)
  })

  it('forwards jump requests to the bridge', () => {
    createLiveFeed(source, { storage: store }).jump('claude:a')
    expect(source.jump).toHaveBeenCalledWith('claude:a')
  })

  it('forwards talk, respond, peek and start to the bridge and returns its answer', async () => {
    const feed = createLiveFeed(source, { storage: store })
    expect(await feed.send('claude:a', 'hi')).toEqual({ success: true })
    expect(await feed.respond('claude:a', 'deny', 'fp')).toEqual({ success: true })
    expect(await feed.peek('claude:a')).toEqual({ success: true, lines: ['ok'] })
    expect(await feed.start('p_app', 'codex')).toEqual({ success: true })
    expect(source.send).toHaveBeenCalledWith('claude:a', 'hi')
    expect(source.respond).toHaveBeenCalledWith('claude:a', 'deny', 'fp')
    expect(source.start).toHaveBeenCalledWith('p_app', 'codex')
  })
})
