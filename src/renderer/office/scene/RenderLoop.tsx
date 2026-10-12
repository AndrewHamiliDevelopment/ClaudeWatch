import { CameraControlsImpl } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import type { AgentView } from '../../../shared/office/types'
import type { FrameMetrics } from '../frame-metrics'
import {
  browserFrameEnv,
  startFrameGovernor,
  type FrameGovernor as Governor,
  type FramePace
} from '../logic/frame-governor'
import { levelForMachine } from '../logic/quality'
import { chooseQuality, machineHints, watchQuality } from '../quality-store'

const SMOOTHING = 0.1
const INPUT_EVENTS = ['pointerdown', 'wheel', 'keydown'] as const

function rendererOf(context: WebGLRenderingContext | WebGL2RenderingContext): string | undefined {
  const info = context.getExtension('WEBGL_debug_renderer_info')
  const renderer: unknown = info ? context.getParameter(info.UNMASKED_RENDERER_WEBGL) : undefined
  return typeof renderer === 'string' ? renderer : undefined
}

interface FrameGovernorProps {
  // The rates of the detail level in use.
  pace: FramePace
  // Their places are watched: one that changes is an agent walking.
  agents: readonly AgentView[]
}

// Idle, the Office draws at its level's idle rate, and at its walking rate while an agent
// walks. While the owner's hand is on it, or the camera is moving, it draws every display
// frame, and for a moment after so the motion does not end on a stutter.
export function FrameGovernor({ pace, agents }: FrameGovernorProps) {
  // The canvas's own way of asking for a frame, kept from before the gate below replaces it.
  const drawRef = useRef(useThree((state) => state.invalidate))
  const setState = useThree((state) => state.set)
  const controls = useThree((state) => state.controls)
  const gl = useThree((state) => state.gl)
  const governorRef = useRef<Governor | null>(null)
  const paceRef = useRef(pace)
  paceRef.current = pace

  useEffect(() => {
    const draw = drawRef.current
    const governor = startFrameGovernor(draw, browserFrameEnv(), () => paceRef.current)
    governorRef.current = governor
    // Camera-controls asks for a frame on every update and the canvas on every React commit,
    // which ran a camera re-framing by itself at the display's rate. Those frames wait for the
    // governor's next one unless the owner's hand is on the Office.
    setState({
      invalidate: (frames) => {
        if (governor.isBoosted()) draw(frames)
      }
    })
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
      setState({ invalidate: draw })
      governor.stop()
      governorRef.current = null
    }
  }, [setState])

  useEffect(() => {
    if (!(controls instanceof CameraControlsImpl)) return
    // Damping keeps updates coming for seconds after the camera looks still (`rest`); that
    // tail is drawn at the level's own rate.
    const boost = (): void => {
      if (controls.active) governorRef.current?.boost('camera')
    }
    controls.addEventListener('update', boost)
    return () => controls.removeEventListener('update', boost)
  }, [controls])

  const places = useMemo(
    () => agents.map((agent) => `${agent.agentKey}:${agent.x}:${agent.z}`).join(' '),
    [agents]
  )
  useEffect(() => governorRef.current?.keepMoving(), [places])

  // Software rendering shows only in the renderer's name, which needs a context to read.
  useEffect(() => {
    chooseQuality(levelForMachine(machineHints(rendererOf(gl.getContext()))))
  }, [gl])

  // Asking from inside a frame is what chains display-rate frames; the governor alone only
  // asks from its own callback, which can land a frame late.
  useFrame((_, delta) => {
    const governor = governorRef.current
    if (!governor) return
    if (governor.isBoosted()) drawRef.current()
    // Out of focus the rate is the background's, which says nothing about the machine.
    if (!document.hasFocus()) return
    watchQuality({
      timeMs: performance.now(),
      intervalMs: delta * 1000,
      targetFps: governor.currentFps()
    })
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
