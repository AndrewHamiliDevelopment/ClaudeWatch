import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startFrameGovernor, targetFps, type VisibilityEnv } from '../logic/frame-governor'

describe('targetFps', () => {
  it('runs 30 fps focused, 10 fps visible but blurred, 0 when hidden', () => {
    expect(targetFps({ isHidden: false, isFocused: true })).toBe(30)
    expect(targetFps({ isHidden: false, isFocused: false })).toBe(10)
    expect(targetFps({ isHidden: true, isFocused: true })).toBe(0)
  })
})

describe('startFrameGovernor', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  function fakeEnv(initial: { isHidden: boolean; isFocused: boolean }) {
    let state = initial
    let wake: () => void = () => undefined
    const env: VisibilityEnv = {
      read: () => state,
      onChange: (callback) => {
        wake = callback
        return () => undefined
      }
    }
    return {
      env,
      set(next: typeof initial) {
        state = next
        wake()
      }
    }
  }

  it('invalidates about 30 times a second while focused', () => {
    const invalidate = vi.fn()
    const { env } = fakeEnv({ isHidden: false, isFocused: true })
    const stop = startFrameGovernor(invalidate, env)
    vi.advanceTimersByTime(1000)
    expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(29)
    expect(invalidate.mock.calls.length).toBeLessThanOrEqual(31)
    stop()
  })

  it('drops to about 10 per second when blurred and stops when hidden', () => {
    const invalidate = vi.fn()
    const page = fakeEnv({ isHidden: false, isFocused: false })
    const stop = startFrameGovernor(invalidate, page.env)
    vi.advanceTimersByTime(1000)
    expect(invalidate.mock.calls.length).toBeLessThanOrEqual(11)

    page.set({ isHidden: true, isFocused: false })
    invalidate.mockClear()
    vi.advanceTimersByTime(2000)
    expect(invalidate).not.toHaveBeenCalled()

    page.set({ isHidden: false, isFocused: true })
    vi.advanceTimersByTime(1000)
    expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(29)
    stop()
  })

  it('stops invalidating after stop()', () => {
    const invalidate = vi.fn()
    const { env } = fakeEnv({ isHidden: false, isFocused: true })
    startFrameGovernor(invalidate, env)()
    invalidate.mockClear()
    vi.advanceTimersByTime(1000)
    expect(invalidate).not.toHaveBeenCalled()
  })
})
