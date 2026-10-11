import { describe, expect, it } from 'vitest'
import { NEEDS_HUMAN, needsHuman } from './attention'

describe('needsHuman', () => {
  it('is true only while the agent waits on a permission or a question', () => {
    expect(NEEDS_HUMAN.map((attention) => needsHuman(attention))).toEqual([true, true])
    const others = ['none', 'done', 'error', 'limited'] as const
    expect(others.map((attention) => needsHuman(attention))).toEqual([false, false, false, false])
  })

  it('is false when there is no session to read', () => {
    expect(needsHuman(undefined)).toBe(false)
  })
})
