import { describe, expect, it, vi } from 'vitest'
import { startFrameGovernor, targetFps, type FrameEnv } from '../logic/frame-governor'

describe('targetFps', () => {
  it('runs 30 fps focused, 10 fps visible but blurred, 0 when hidden', () => {
    expect(targetFps({ isHidden: false, isFocused: true })).toBe(30)
    expect(targetFps({ isHidden: false, isFocused: false })).toBe(10)
    expect(targetFps({ isHidden: true, isFocused: true })).toBe(0)
  })
})

describe('startFrameGovernor', () => {
  // A display that delivers a frame every `intervalMs`, driven by hand.
  function fakeDisplay(initial: { isHidden: boolean; isFocused: boolean }, intervalMs = 1000 / 60) {
    let state = initial
    let wake: () => void = () => undefined
    let pending: ((timeMs: number) => void) | null = null
    let nowMs = 0
    const env: FrameEnv = {
      read: () => state,
      onChange: (callback) => {
        wake = callback
        return () => undefined
      },
      requestFrame: (callback) => {
        pending = callback
        return 1
      },
      cancelFrame: () => {
        pending = null
      },
      now: () => nowMs
    }
    return {
      env,
      set(next: typeof initial) {
        state = next
        wake()
      },
      run(durationMs: number) {
        const endMs = nowMs + durationMs
        while (pending && nowMs + intervalMs <= endMs + 1e-6) {
          nowMs += intervalMs
          const callback = pending
          pending = null
          callback(nowMs)
        }
        nowMs = endMs
      }
    }
  }

  it('invalidates on every second display frame while focused and idle', () => {
    const invalidate = vi.fn()
    const display = fakeDisplay({ isHidden: false, isFocused: true })
    const governor = startFrameGovernor(invalidate, display.env)
    display.run(1000)
    expect(invalidate).toHaveBeenCalledTimes(30)
    governor.stop()
  })

  it('still runs 30 a second on a 120 Hz display', () => {
    const invalidate = vi.fn()
    const display = fakeDisplay({ isHidden: false, isFocused: true }, 1000 / 120)
    const governor = startFrameGovernor(invalidate, display.env)
    display.run(1000)
    expect(invalidate).toHaveBeenCalledTimes(30)
    governor.stop()
  })

  it('drops to 10 per second when blurred and stops when hidden', () => {
    const invalidate = vi.fn()
    const display = fakeDisplay({ isHidden: false, isFocused: false })
    const governor = startFrameGovernor(invalidate, display.env)
    display.run(1000)
    expect(invalidate).toHaveBeenCalledTimes(10)

    display.set({ isHidden: true, isFocused: false })
    invalidate.mockClear()
    display.run(2000)
    expect(invalidate).not.toHaveBeenCalled()

    display.set({ isHidden: false, isFocused: true })
    display.run(1000)
    expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(29)
    governor.stop()
  })

  it('renders every display frame for 400 ms after a boost, then returns to 30', () => {
    const invalidate = vi.fn()
    const display = fakeDisplay({ isHidden: false, isFocused: true })
    const governor = startFrameGovernor(invalidate, display.env)
    display.run(100)
    invalidate.mockClear()

    governor.boost()
    expect(governor.isBoosted()).toBe(true)
    display.run(400)
    // 24 display frames fit in 400 ms; the one on the boundary may fall either side.
    expect(invalidate.mock.calls.length).toBeGreaterThanOrEqual(23)

    expect(governor.isBoosted()).toBe(false)
    invalidate.mockClear()
    display.run(1000)
    expect(invalidate).toHaveBeenCalledTimes(30)
    governor.stop()
  })

  it('does not boost a hidden page', () => {
    const invalidate = vi.fn()
    const display = fakeDisplay({ isHidden: true, isFocused: false })
    const governor = startFrameGovernor(invalidate, display.env)
    governor.boost()
    display.run(500)
    expect(invalidate).not.toHaveBeenCalled()
    governor.stop()
  })

  it('stops invalidating after stop()', () => {
    const invalidate = vi.fn()
    const display = fakeDisplay({ isHidden: false, isFocused: true })
    startFrameGovernor(invalidate, display.env).stop()
    invalidate.mockClear()
    display.run(1000)
    expect(invalidate).not.toHaveBeenCalled()
  })
})
