import { describe, expect, it } from 'vitest'
import { buildAttentionQueue, newAttentionItems, nextAttentionKey } from '../logic/attention-queue'
import { makeSession } from './fixtures'

describe('attention queue', () => {
  const sessions = [
    makeSession({ key: 'claude:a', attention: 'question', updatedAtMs: 300 }),
    makeSession({ key: 'claude:b', attention: 'permission', updatedAtMs: 100 }),
    makeSession({ key: 'codex:c', attention: 'done', updatedAtMs: 50 }),
    makeSession({ key: 'claude:d', attention: 'error', updatedAtMs: 10 }),
    makeSession({ key: 'claude:e', attention: 'permission', updatedAtMs: 200 })
  ]

  it('holds only permission and question sessions, oldest first', () => {
    expect(buildAttentionQueue(sessions).map((item) => item.sessionKey)).toEqual([
      'claude:b',
      'claude:e',
      'claude:a'
    ])
  })

  it('moves Next to the item after the current one, wrapping, or to the head', () => {
    const queue = buildAttentionQueue(sessions)
    expect(nextAttentionKey(queue, null)).toBe('claude:b')
    expect(nextAttentionKey(queue, 'claude:b')).toBe('claude:e')
    expect(nextAttentionKey(queue, 'claude:a')).toBe('claude:b')
    expect(nextAttentionKey(queue, 'claude:zzz')).toBe('claude:b')
    expect(nextAttentionKey([], null)).toBeNull()
  })

  it('reports items that were not in the previous queue', () => {
    const before = buildAttentionQueue(sessions.slice(0, 2))
    const after = buildAttentionQueue(sessions)
    expect(newAttentionItems(before, after).map((item) => item.sessionKey)).toEqual(['claude:e'])
  })
})
