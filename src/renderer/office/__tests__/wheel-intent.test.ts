import { describe, expect, it } from 'vitest'
import {
  createWheelClassifier,
  nextZoomGoal,
  zoomFactor,
  type WheelInput
} from '../logic/wheel-intent'

function wheel(overrides: Partial<WheelInput> = {}): WheelInput {
  return {
    deltaX: 0,
    deltaY: 0,
    deltaMode: 0,
    wheelDeltaY: null,
    hasZoomModifier: false,
    timeMs: 0,
    ...overrides
  }
}

const LIMITS = { min: 4, max: 108 }

describe('wheel classification', () => {
  it('reads a ctrlKey wheel with small deltas as a pinch', () => {
    const classify = createWheelClassifier()
    expect(classify(wheel({ deltaY: -1, wheelDeltaY: 3, hasZoomModifier: true }))).toBe('pinch')
  })

  it('reads a line-mode event as a notched mouse wheel', () => {
    const classify = createWheelClassifier()
    expect(classify(wheel({ deltaY: 3, deltaMode: 1 }))).toBe('wheel-zoom')
  })

  it('reads a 120-multiple wheelDelta with no sideways motion as a notched mouse wheel', () => {
    const classify = createWheelClassifier()
    expect(classify(wheel({ deltaY: 100, wheelDeltaY: -120 }))).toBe('wheel-zoom')
    expect(classify(wheel({ deltaY: 200, wheelDeltaY: -240, timeMs: 500 }))).toBe('wheel-zoom')
  })

  it('reads small pixel deltas as a trackpad scroll', () => {
    const classify = createWheelClassifier()
    expect(classify(wheel({ deltaY: 3, wheelDeltaY: -9 }))).toBe('scroll-pan')
    expect(classify(wheel({ deltaX: 4, deltaY: 40, wheelDeltaY: -120, timeMs: 400 }))).toBe(
      'scroll-pan'
    )
  })

  it('keeps a trackpad swipe a pan when one of its deltas lands on a 120 multiple', () => {
    const classify = createWheelClassifier()
    expect(classify(wheel({ deltaY: 3, wheelDeltaY: -9, timeMs: 0 }))).toBe('scroll-pan')
    expect(classify(wheel({ deltaY: 40, wheelDeltaY: -120, timeMs: 16 }))).toBe('scroll-pan')
    // A new gesture after a pause is classified afresh.
    expect(classify(wheel({ deltaY: 100, wheelDeltaY: -120, timeMs: 600 }))).toBe('wheel-zoom')
  })

  it('reads any wheel with Ctrl or Cmd held as a pinch, whatever the device', () => {
    const classify = createWheelClassifier()
    const input = wheel({ deltaY: 100, wheelDeltaY: -120, hasZoomModifier: true })
    expect(classify(input)).toBe('pinch')
  })
})

describe('zoom goal', () => {
  it('zooms in by about 1.2 per notch', () => {
    const factor = zoomFactor('wheel-zoom', wheel({ deltaY: -100 }))
    expect(factor).toBeCloseTo(Math.exp(0.18), 6)
    expect(factor ** 5).toBeGreaterThan(2.49 * 0.95)
    expect(factor ** 5).toBeLessThan(2.49 * 1.05)
  })

  it('steps the same amount per notched event, whatever delta the browser reports', () => {
    const oneNotchOut = Math.exp(-0.18)
    // Chrome on macOS reports about 4 px for a slow notch and hundreds for a fast one.
    for (const deltaY of [4, 100, 900])
      expect(zoomFactor('wheel-zoom', wheel({ deltaY }))).toBeCloseTo(oneNotchOut, 9)
    expect(zoomFactor('wheel-zoom', wheel({ deltaY: 3, deltaMode: 1 }))).toBeCloseTo(oneNotchOut, 9)
    expect(zoomFactor('wheel-zoom', wheel({ deltaY: -4 }))).toBeCloseTo(Math.exp(0.18), 9)
  })

  it('does not zoom on a notched event with no vertical travel', () => {
    expect(zoomFactor('wheel-zoom', wheel({ deltaX: 3, deltaMode: 1 }))).toBe(1)
  })

  it('zooms a Ctrl or Cmd wheel notch no further than a plain notch', () => {
    const notch = wheel({ deltaY: 120, wheelDeltaY: -120, hasZoomModifier: true })
    expect(zoomFactor('pinch', notch)).toBeCloseTo(zoomFactor('wheel-zoom', notch), 9)
    expect(zoomFactor('pinch', wheel({ deltaY: -120, hasZoomModifier: true }))).toBeCloseTo(
      Math.exp(0.18),
      9
    )
  })

  it('zooms a pinch by e^0.01 per pixel, so 60 px is about 1.82', () => {
    const factor = zoomFactor('pinch', wheel({ deltaY: -1 }))
    expect(factor ** 60).toBeCloseTo(Math.exp(0.6), 6)
  })

  it('returns to the start when the same input is reversed', () => {
    let goal = 8.2
    for (let index = 0; index < 60; index += 1)
      goal = nextZoomGoal(goal, zoomFactor('pinch', wheel({ deltaY: -1 })), LIMITS)
    for (let index = 0; index < 60; index += 1)
      goal = nextZoomGoal(goal, zoomFactor('pinch', wheel({ deltaY: 1 })), LIMITS)
    expect(goal).toBeCloseTo(8.2, 9)
  })

  it('clamps the goal to the zoom limits', () => {
    expect(nextZoomGoal(100, 2, LIMITS)).toBe(108)
    expect(nextZoomGoal(5, 0.5, LIMITS)).toBe(4)
  })

  it('does not zoom on a scroll-pan', () => {
    expect(zoomFactor('scroll-pan', wheel({ deltaY: 50 }))).toBe(1)
  })
})
