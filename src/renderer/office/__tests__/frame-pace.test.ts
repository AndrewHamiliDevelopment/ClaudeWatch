import { expect, it, vi } from 'vitest'
import { startFrameGovernor, targetFps, type FrameEnv } from '../logic/frame-governor'

// A display and a timer on one clock, driven by hand; counts how often the page is woken.
function paced(
  pace: { idleFps: number; walkFps: number },
  visibility = { isHidden: false, isFocused: true },
  displayHz = 60
) {
  const intervalMs = 1000 / displayHz
  let nowMs = 0
  let frame: ((timeMs: number) => void) | null = null
  let timer: { dueMs: number; callback: () => void } | null = null
  const invalidate = vi.fn()
  const env: FrameEnv = {
    read: () => visibility,
    onChange: () => () => undefined,
    requestFrame: (callback) => {
      frame = callback
      return 1
    },
    cancelFrame: () => {
      frame = null
    },
    sleep: (callback, delayMs) => {
      timer = { dueMs: nowMs + delayMs, callback }
      return 1
    },
    cancelSleep: () => {
      timer = null
    },
    now: () => nowMs
  }
  const governor = startFrameGovernor(invalidate, env, () => pace)
  // Steps the clock one display frame at a time; a timer fires before the frame it falls in.
  const run = (durationMs: number): { drawn: number; wakes: number } => {
    invalidate.mockClear()
    let wakes = 0
    const endMs = nowMs + durationMs
    while (nowMs + intervalMs <= endMs + 1e-6) {
      nowMs += intervalMs
      if (timer && timer.dueMs <= nowMs) {
        const { callback } = timer
        timer = null
        wakes++
        callback()
      }
      if (frame) {
        const callback = frame
        frame = null
        wakes++
        callback(nowMs)
      }
    }
    nowMs = endMs
    return { drawn: invalidate.mock.calls.length, wakes }
  }
  return { governor, run }
}

it('draws the idle rate of the level while nothing moves', () => {
  const { governor, run } = paced({ idleFps: 20, walkFps: 30 })
  expect(run(1000).drawn).toBe(20)
  expect(governor.currentFps()).toBe(20)
  governor.stop()
})

it('draws the walking rate while something moves, and for a while after', () => {
  const { governor, run } = paced({ idleFps: 10, walkFps: 30 })
  run(500)
  governor.keepMoving()
  expect(governor.currentFps()).toBe(30)
  expect(run(1000).drawn).toBeGreaterThanOrEqual(29)
  run(1500)
  expect(governor.currentFps()).toBe(10)
  expect(run(1000).drawn).toBe(10)
  governor.stop()
})

it('follows a change of level without being restarted', () => {
  const pace = { idleFps: 20, walkFps: 30 }
  const { governor, run } = paced(pace)
  run(1000)
  pace.idleFps = 10
  run(200)
  expect(run(1000).drawn).toBe(10)
  governor.stop()
})

it('sleeps between slow frames instead of waking on every display frame', () => {
  const { governor, run } = paced({ idleFps: 10, walkFps: 30 }, undefined, 120)
  run(500)
  const { drawn, wakes } = run(1000)
  expect(drawn).toBe(10)
  // A timer and one or two display frames per drawn frame, not all 120.
  expect(wakes).toBeLessThanOrEqual(40)
  governor.stop()
})

it('wakes at once from a sleep when input arrives', () => {
  const { governor, run } = paced({ idleFps: 10, walkFps: 30 })
  run(500)
  governor.boost()
  expect(run(100).drawn).toBeGreaterThanOrEqual(5)
  governor.stop()
})

it('draws a camera that moves by itself at 60 a second, whatever the display', () => {
  const { governor, run } = paced({ idleFps: 20, walkFps: 30 }, undefined, 120)
  run(500)
  governor.boost('camera')
  // The frame chain inside the canvas is for the owner's hand only.
  expect(governor.isBoosted()).toBe(false)
  const { drawn } = run(400)
  expect(drawn).toBeGreaterThanOrEqual(23)
  expect(drawn).toBeLessThanOrEqual(25)
  governor.boost('input')
  expect(run(400).drawn).toBeGreaterThanOrEqual(47)
  governor.stop()
})

it('does not draw at display rate for a camera that moves by itself in the background', () => {
  const { governor, run } = paced(
    { idleFps: 20, walkFps: 30 },
    { isHidden: false, isFocused: false }
  )
  governor.boost('camera')
  expect(governor.isBoosted()).toBe(false)
  expect(run(1000).drawn).toBe(5)
  governor.boost('input')
  expect(governor.isBoosted()).toBe(true)
  governor.stop()
})

it('draws 5 a second in the background while nothing moves and 10 while something walks', () => {
  const { governor, run } = paced(
    { idleFps: 20, walkFps: 30 },
    { isHidden: false, isFocused: false }
  )
  run(1000)
  expect(run(1000).drawn).toBe(5)
  governor.keepMoving()
  expect(governor.currentFps()).toBe(10)
  expect(run(1000).drawn).toBeGreaterThanOrEqual(9)
  governor.stop()
})

it('never draws faster out of focus than in focus', () => {
  const blurred = { isHidden: false, isFocused: false }
  expect(targetFps(blurred, 20, 10)).toBe(10)
  expect(targetFps(blurred, 4, 10)).toBe(4)
  expect(targetFps({ isHidden: false, isFocused: true }, 20, 10)).toBe(20)
  expect(targetFps({ isHidden: true, isFocused: true }, 20, 10)).toBe(0)
})
