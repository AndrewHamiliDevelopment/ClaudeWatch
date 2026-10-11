import { describe, expect, it } from 'vitest'
import { releaseVelocity, startFling, stepFling, type PointerSample } from '../logic/pan-inertia'

// A hand moving right at a steady speed, sampled every 16 ms up to the release.
function steadyDrag(pixelsPerSecond: number, releaseMs: number): PointerSample[] {
  return Array.from({ length: 12 }, (_, index) => {
    const timeMs = releaseMs - (11 - index) * 16
    return { timeMs, x: (pixelsPerSecond * timeMs) / 1000, y: 0 }
  })
}

function coast(pixelsPerSecond: number) {
  let fling = startFling({ vx: pixelsPerSecond, vy: 0 })
  let travelled = 0
  let elapsedMs = 0
  while (fling) {
    const step = stepFling(fling, 1 / 60)
    travelled += step.dx
    elapsedMs += 1000 / 60
    fling = step.fling
  }
  return { travelled, elapsedMs }
}

describe('release velocity', () => {
  it('measures the speed of the hand at release', () => {
    const velocity = releaseVelocity(steadyDrag(800, 1000), 1000)
    expect(velocity.vx).toBeCloseTo(800, 3)
    expect(velocity.vy).toBeCloseTo(0, 6)
  })

  it('is zero when the hand stopped and held before letting go', () => {
    expect(releaseVelocity(steadyDrag(800, 1000), 1400)).toEqual({ vx: 0, vy: 0 })
  })

  it('is zero for a click without movement', () => {
    expect(releaseVelocity([{ timeMs: 10, x: 5, y: 5 }], 20)).toEqual({ vx: 0, vy: 0 })
  })
})

describe('fling', () => {
  it('does not start under 300 px/s', () => {
    expect(startFling({ vx: 200, vy: 200 })).toBeNull()
    expect(startFling({ vx: 300, vy: 0 })).not.toBeNull()
  })

  it('caps the speed at 3,000 px/s and keeps the direction', () => {
    const fling = startFling({ vx: 6000, vy: -8000 })
    expect(Math.hypot(fling?.vx ?? 0, fling?.vy ?? 0)).toBeCloseTo(3000, 6)
    expect((fling?.vy ?? 0) / (fling?.vx ?? 1)).toBeCloseTo(-8000 / 6000, 6)
  })

  it('travels 60 to 250 px from an 800 px/s release and stops within 800 ms', () => {
    const { travelled, elapsedMs } = coast(800)
    expect(travelled).toBeGreaterThan(60)
    expect(travelled).toBeLessThan(250)
    expect(elapsedMs).toBeLessThanOrEqual(800)
  })

  it('travels the same distance whatever the frame rate', () => {
    let fling = startFling({ vx: 800, vy: 0 })
    let travelled = 0
    while (fling) {
      const step = stepFling(fling, 1 / 120)
      travelled += step.dx
      fling = step.fling
    }
    expect(Math.abs(travelled - coast(800).travelled)).toBeLessThan(2)
  })
})
