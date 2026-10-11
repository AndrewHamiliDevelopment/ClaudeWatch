import { describe, it, expect } from 'vitest'
import { applyFeed } from './apply-feed'
import type { OfficeSnapshot, SessionRef } from './types'

const session = (key: string, overrides: Partial<SessionRef> = {}): SessionRef => ({
  key,
  provider: 'claude',
  sessionId: key.split(':')[1] ?? key,
  pid: 100,
  name: 'app',
  cwd: '/repo/app',
  projectKey: 'p_1',
  projectLabel: 'app',
  worktree: null,
  host: 'terminal',
  orcaPaneKey: null,
  activity: 'idle',
  attention: 'none',
  currentTool: null,
  subagents: [],
  startedAtMs: 1,
  updatedAtMs: 1,
  ...overrides
})

const snapshot = (sessions: SessionRef[], rev = 1): OfficeSnapshot => ({
  rev,
  generatedAtMs: 10,
  sessions,
  sources: []
})

describe('applyFeed', () => {
  it('replaces state with the hello snapshot', () => {
    const hello = snapshot([session('claude:a')])
    expect(applyFeed(null, { type: 'hello', v: 1, snapshot: hello })).toEqual(hello)
  })

  it('upserts and removes sessions from a patch', () => {
    const start = snapshot([session('claude:a'), session('claude:b')])
    const next = applyFeed(start, {
      type: 'patch',
      v: 1,
      seq: 2,
      upserts: [session('claude:a', { activity: 'editing' }), session('claude:c')],
      removed: ['claude:b']
    })
    expect(next?.sessions.map((s) => [s.key, s.activity])).toEqual([
      ['claude:a', 'editing'],
      ['claude:c', 'idle']
    ])
    expect(next?.rev).toBe(2)
  })

  it('ignores a patch that arrives before any hello', () => {
    expect(
      applyFeed(null, { type: 'patch', v: 1, seq: 1, upserts: [session('claude:a')], removed: [] })
    ).toBeNull()
  })

  it('clears state on resync so the next hello rebuilds it', () => {
    expect(applyFeed(snapshot([session('claude:a')]), { type: 'resync' })).toBeNull()
  })
})
