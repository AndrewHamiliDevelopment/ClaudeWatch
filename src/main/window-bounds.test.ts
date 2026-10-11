import { EventEmitter } from 'events'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { isOnAnyDisplay, rememberBounds, restoreBounds } from './window-bounds'

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
    const saved = { x: 300, y: 300, width: 1400, height: 800 }
    expect(restoreBounds(saved, [laptop], fallback)).toEqual({
      x: 112,
      y: 145,
      width: 1400,
      height: 800
    })
  })

  it('shrinks a window that is larger than the display it sits on', () => {
    const saved = { x: -100, y: 0, width: 1800, height: 1000 }
    expect(restoreBounds(saved, [laptop], fallback)).toEqual(laptop)
  })

  it('ignores a saved value that is not a rectangle', () => {
    const forged = { x: 'left', y: 0, width: -5, height: Number.NaN }
    expect(restoreBounds(forged as never, [laptop], fallback)).toEqual(fallback)
  })

  it('works on a display to the left of the main one', () => {
    const left = { x: -3840, y: 0, width: 3840, height: 2135 }
    const saved = { x: -3000, y: 200, width: 1600, height: 1000 }
    expect(restoreBounds(saved, [laptop, left], fallback)).toEqual(saved)
  })

  it('falls back when only a strip of the window is left on a connected display', () => {
    // It lived on the side display; 112 px of it overlapped the laptop.
    const saved = { x: 1400, y: 100, width: 2000, height: 1200 }
    expect(restoreBounds(saved, [laptop], fallback)).toEqual(fallback)
  })

  it('rounds to whole pixels, which is all a window accepts', () => {
    const saved = { x: 100.4, y: 99.6, width: 1000.5, height: 600.2 }
    expect(restoreBounds(saved, [laptop], fallback)).toEqual({
      x: 100,
      y: 100,
      width: 1001,
      height: 600
    })
  })

  it('leaves room for the minimum size the window will take', () => {
    const tiny = { x: 1400, y: 880, width: 100, height: 60 }
    expect(restoreBounds(tiny, [laptop], fallback, { width: 800, height: 560 })).toEqual({
      x: 712,
      y: 385,
      width: 800,
      height: 560
    })
  })
})

describe('isOnAnyDisplay', () => {
  it('tells whether any part of a rectangle is on a connected display', () => {
    expect(isOnAnyDisplay({ x: 1500, y: 100, width: 50, height: 50 }, [laptop])).toBe(true)
    expect(isOnAnyDisplay({ x: 1700, y: 100, width: 50, height: 50 }, [laptop])).toBe(false)
  })
})

describe('rememberBounds', () => {
  class FakeWindow extends EventEmitter {
    bounds = { x: 10, y: 20, width: 1280, height: 820 }
    getNormalBounds = () => this.bounds
    isDestroyed = () => false
  }
  let window: FakeWindow
  const save = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    save.mockReset()
    window = new FakeWindow()
    rememberBounds(window, save)
  })
  afterEach(() => vi.useRealTimers())

  it('saves once the user stops moving or resizing', () => {
    window.emit('moved')
    window.emit('resized')
    expect(save).not.toHaveBeenCalled()
    vi.advanceTimersByTime(400)
    expect(save).toHaveBeenCalledExactlyOnceWith(window.bounds)
  })

  it('saves a move that is still pending when the window closes', () => {
    window.emit('moved')
    window.emit('close')
    vi.advanceTimersByTime(400)
    expect(save).toHaveBeenCalledExactlyOnceWith(window.bounds)
  })

  it('keeps the remembered place when the window was never moved', () => {
    // Opened at the default because its display was unplugged, then closed.
    window.emit('close')
    vi.advanceTimersByTime(400)
    expect(save).not.toHaveBeenCalled()
  })
})
