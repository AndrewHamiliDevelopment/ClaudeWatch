import { describe, expect, it } from 'vitest'
import { anchorTruck, easeZoom } from '../logic/zoom-anchor'
import { projectToScreen, screenAxes, type ScreenView } from '../logic/zone-framing'

const VIEWPORT = { width: 1440, height: 900 }

// Mirrors camera-controls truck(x, y): the target moves x along screen-right and y down the screen.
function truck(view: ScreenView, amount: { x: number; y: number }, zoom: number): ScreenView {
  const { right, up } = screenAxes(view.azimuth)
  const target: [number, number, number] = [
    view.target[0] + right[0] * amount.x - up[0] * amount.y,
    view.target[1] + right[1] * amount.x - up[1] * amount.y,
    view.target[2] + right[2] * amount.x - up[2] * amount.y
  ]
  return { ...view, target, zoom }
}

// Deterministic pseudo-random values in [0, 1).
function sequence(seed: number): () => number {
  let state = seed
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296
    return state / 4294967296
  }
}

describe('zoom anchoring', () => {
  it('keeps the world point under the cursor on the same pixel for any cursor and azimuth', () => {
    const random = sequence(7)
    for (let trial = 0; trial < 200; trial += 1) {
      const view: ScreenView = {
        target: [random() * 80 - 40, random() * 4, random() * 80 - 40],
        zoom: 4 + random() * 100,
        azimuth: random() * Math.PI * 2
      }
      const next = 4 + random() * 100
      const point = { x: random() * 60 - 30, y: random() * 3, z: random() * 60 - 30 }
      const cursor = projectToScreen(point, view, VIEWPORT)
      const offset = { x: cursor.x - VIEWPORT.width / 2, y: cursor.y - VIEWPORT.height / 2 }

      const moved = truck(view, anchorTruck(offset, view.zoom, next), next)
      const after = projectToScreen(point, moved, VIEWPORT)

      expect(after.x).toBeCloseTo(cursor.x, 6)
      expect(after.y).toBeCloseTo(cursor.y, 6)
    }
  })

  it('does not shift the target when the zoom cannot change (at a limit)', () => {
    expect(anchorTruck({ x: 300, y: -200 }, 108, 108)).toEqual({ x: 0, y: 0 })
  })

  it('does not shift the target when zooming about the screen centre', () => {
    expect(anchorTruck({ x: 0, y: 0 }, 10, 20)).toEqual({ x: 0, y: 0 })
  })
})

describe('zoom easing', () => {
  it('moves toward the goal in log space with an 80 ms time constant', () => {
    const next = easeZoom(10, 20, 0.08, false)
    expect(Math.log(next / 10) / Math.log(2)).toBeCloseTo(1 - Math.exp(-1), 6)
  })

  it('covers the same fraction whatever the frame rate', () => {
    let fine = 10
    for (let step = 0; step < 4; step += 1) fine = easeZoom(fine, 40, 0.004, false)
    expect(fine).toBeCloseTo(easeZoom(10, 40, 0.016, false), 9)
  })

  it('lands exactly on the goal once it is close', () => {
    expect(easeZoom(19.9999, 20, 0.016, false)).toBe(20)
  })

  it('reaches the goal in one step under reduced motion', () => {
    expect(easeZoom(10, 20, 0.016, true)).toBe(20)
  })
})
