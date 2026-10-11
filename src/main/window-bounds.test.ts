import { describe, expect, it } from 'vitest'
import { restoreBounds } from './window-bounds'

const laptop = { x: 0, y: 25, width: 1512, height: 920 }
const side = { x: 1512, y: 0, width: 2560, height: 1440 }
const fallback = { width: 1280, height: 820 }

describe('restoreBounds', () => {
  it('opens at the default size, centred by the system, when nothing was saved', () => {
    expect(restoreBounds(null, [laptop], fallback)).toEqual(fallback)
  })

  it('reopens where the window was left, on the side display too', () => {
    const saved = { x: 1700, y: 120, width: 1600, height: 1000 }
    expect(restoreBounds(saved, [laptop, side], fallback)).toEqual(saved)
  })

  it('falls back when the display it was on is no longer connected', () => {
    const saved = { x: 1700, y: 120, width: 1600, height: 1000 }
    expect(restoreBounds(saved, [laptop], fallback)).toEqual(fallback)
  })

  it('pulls a window that hangs off its display back inside it', () => {
    const saved = { x: 1200, y: 600, width: 1600, height: 1000 }
    expect(restoreBounds(saved, [laptop], fallback)).toEqual({
      x: 0,
      y: 25,
      width: 1512,
      height: 920
    })
  })

  it('ignores a saved value that is not a rectangle', () => {
    const forged = { x: 'left', y: 0, width: -5, height: Number.NaN }
    expect(restoreBounds(forged as never, [laptop], fallback)).toEqual(fallback)
  })
})
