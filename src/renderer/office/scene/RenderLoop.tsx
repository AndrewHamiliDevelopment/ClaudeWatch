import { CameraControlsImpl } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { FrameMetrics } from '../frame-metrics'
import { browserFrameEnv, startFrameGovernor, type FrameGovernor } from '../logic/frame-governor'

const SMOOTHING = 0.1
const INPUT_EVENTS = ['pointerdown', 'wheel', 'keydown'] as const

// Idle, the Office draws 30 frames a second. While the owner's hand is on it, or the camera is
// moving, it draws every display frame, and for a moment after so the motion does not end on a stutter.
export function FrameGovernor() {
  const invalidate = useThree((state) => state.invalidate)
  const controls = useThree((state) => state.controls)
  const governorRef = useRef<FrameGovernor | null>(null)

  useEffect(() => {
    const governor = startFrameGovernor(invalidate, browserFrameEnv())
    governorRef.current = governor
    const boost = (): void => governor.boost()
    // A pointer that only hovers moves nothing; one with a button down is dragging the camera.
    const onPointerMove = (event: PointerEvent): void => {
      if (event.buttons !== 0) governor.boost()
    }
    const listening = { capture: true, passive: true }
    for (const type of INPUT_EVENTS) window.addEventListener(type, boost, listening)
    window.addEventListener('pointermove', onPointerMove, listening)
    return () => {
      for (const type of INPUT_EVENTS) window.removeEventListener(type, boost, listening)
      window.removeEventListener('pointermove', onPointerMove, listening)
      governor.stop()
      governorRef.current = null
    }
  }, [invalidate])

  useEffect(() => {
    if (!(controls instanceof CameraControlsImpl)) return
    const boost = (): void => governorRef.current?.boost()
    controls.addEventListener('update', boost)
    return () => controls.removeEventListener('update', boost)
  }, [controls])

  // Asking from inside a frame is what chains display-rate frames; the governor alone only
  // asks from its own callback, which can land a frame late.
  useFrame(() => {
    if (governorRef.current?.isBoosted()) invalidate()
  })
  return null
}

// gl.info resets at the start of each render, so reading it in useFrame gives the previous frame's totals.
// frameMs is the interval between frames (what the governor controls), not GPU time.
export function MetricsProbe({ metrics }: { metrics: FrameMetrics }) {
  useFrame(({ gl }, delta) => {
    if (delta > 0) {
      metrics.frameMs += (delta * 1000 - metrics.frameMs) * SMOOTHING
      metrics.fps = metrics.frameMs > 0 ? 1000 / metrics.frameMs : 0
    }
    metrics.drawCalls = gl.info.render.calls
    metrics.triangles = gl.info.render.triangles
  })
  return null
}
