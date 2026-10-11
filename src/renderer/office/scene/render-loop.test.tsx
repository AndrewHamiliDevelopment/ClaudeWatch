import { render } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { FrameGovernor } from './RenderLoop'

const { surface, frame, FakeControls } = vi.hoisted(() => {
  class FakeControls {
    private readonly listeners = new Set<() => void>()
    addEventListener(_type: string, listener: () => void): void {
      this.listeners.add(listener)
    }
    removeEventListener(_type: string, listener: () => void): void {
      this.listeners.delete(listener)
    }
    emitUpdate(): void {
      this.listeners.forEach((listener) => listener())
    }
  }
  return {
    FakeControls,
    frame: { callback: null as (() => void) | null },
    surface: { invalidate: vi.fn(), controls: new FakeControls() }
  }
})
vi.mock('@react-three/drei', () => ({ CameraControlsImpl: FakeControls }))
vi.mock('@react-three/fiber', () => ({
  useThree: (selector: (state: typeof surface) => object) => selector(surface),
  useFrame: (callback: () => void) => {
    frame.callback = callback
  }
}))

// Whether a rendered frame asks for the next one, which is what keeps the canvas at display rate.
function keepsRendering(): boolean {
  surface.invalidate.mockClear()
  frame.callback?.()
  return surface.invalidate.mock.calls.length > 0
}

beforeEach(() => {
  vi.spyOn(document, 'hasFocus').mockReturnValue(true)
})

it('leaves the idle rate to the governor when nothing is happening', () => {
  render(<FrameGovernor />)
  expect(keepsRendering()).toBe(false)
})

it('renders every frame while the wheel, a key or a pressed pointer is active', () => {
  render(<FrameGovernor />)
  window.dispatchEvent(new WheelEvent('wheel'))
  expect(keepsRendering()).toBe(true)
})

it('does not boost for a pointer that only hovers', () => {
  render(<FrameGovernor />)
  window.dispatchEvent(new MouseEvent('pointermove', { buttons: 0 }))
  expect(keepsRendering()).toBe(false)
  window.dispatchEvent(new MouseEvent('pointermove', { buttons: 1 }))
  expect(keepsRendering()).toBe(true)
})

it('renders every frame while the camera moves by itself, as in a fly-to', () => {
  render(<FrameGovernor />)
  surface.controls.emitUpdate()
  expect(keepsRendering()).toBe(true)
})

it('falls back to the idle rate 400 ms after the last input', () => {
  const now = vi.spyOn(performance, 'now').mockReturnValue(1000)
  render(<FrameGovernor />)
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'q' }))
  now.mockReturnValue(1399)
  expect(keepsRendering()).toBe(true)
  now.mockReturnValue(1401)
  expect(keepsRendering()).toBe(false)
})
