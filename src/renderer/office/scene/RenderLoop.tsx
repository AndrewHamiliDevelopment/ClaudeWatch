import { useFrame, useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import type { FrameMetrics } from '../frame-metrics'
import { browserVisibilityEnv, startFrameGovernor } from '../logic/frame-governor'

const SMOOTHING = 0.1

export function FrameGovernor() {
  const invalidate = useThree((state) => state.invalidate)
  useEffect(() => startFrameGovernor(invalidate, browserVisibilityEnv()), [invalidate])
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
