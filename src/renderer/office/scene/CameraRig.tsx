import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useRef } from 'react'
import type { AgentView } from '../../../shared/office/types'
import {
  BAND_ZOOM,
  buildingFraming,
  createWheelStepper,
  ISO_POLAR,
  snapAzimuth,
  stepBand,
  type ZoomBand,
  type ZoomDirection
} from '../logic/camera-bands'
import type { CameraRequest } from '../logic/office-reducer'
import type { FloorGeometry } from '../scene-model'

const LOOK_HEIGHT = 0.6
const WHEEL_THRESHOLD = 40
const WHEEL_COOLDOWN_MS = 320
const { ACTION } = CameraControlsImpl

interface CameraRigProps {
  floorCount: number
  floor: FloorGeometry
  agents: readonly AgentView[]
  selectedAgentKey: string | null
  request: CameraRequest | null
  isReducedMotion: boolean
  onBandChange: (band: ZoomBand) => void
}

// Isometric orthographic camera: fixed 35° elevation, drag pans, wheel or -/= snap between
// three zoom bands, Q/E turn 90°, fly-to cuts instead of gliding under prefers-reduced-motion.
export function CameraRig({
  floor,
  floorCount,
  agents,
  selectedAgentKey,
  request,
  isReducedMotion,
  onBandChange
}: CameraRigProps) {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const bandRef = useRef<ZoomBand>('floor')
  const size = useThree((state) => state.size)
  const framing = buildingFraming(floor, floorCount, size)
  const latestRef = useRef({
    agents,
    selectedAgentKey,
    isAnimated: !isReducedMotion,
    onBandChange,
    framing
  })
  latestRef.current = {
    agents,
    selectedAgentKey,
    isAnimated: !isReducedMotion,
    onBandChange,
    framing
  }
  const domElement = useThree((state) => state.gl.domElement)

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.mouseButtons.left = ACTION.TRUCK
    controls.mouseButtons.right = ACTION.TRUCK
    controls.mouseButtons.middle = ACTION.NONE
    controls.mouseButtons.wheel = ACTION.NONE
    controls.touches.one = ACTION.TOUCH_TRUCK
    controls.touches.two = ACTION.NONE
    controls.touches.three = ACTION.NONE
  }, [])

  const setBand = useRef((band: ZoomBand): void => {
    bandRef.current = band
    latestRef.current.onBandChange(band)
  }).current

  // Shared by the wheel and the -/= keys; the desk band centres on the selected agent if there is one.
  const stepZoomBand = useRef((direction: ZoomDirection): void => {
    const controls = controlsRef.current
    const next = stepBand(bandRef.current, direction)
    if (!controls || next === bandRef.current) return
    setBand(next)
    const { agents: current, selectedAgentKey: selectedKey, isAnimated } = latestRef.current
    const selected = current.find((agent) => agent.agentKey === selectedKey)
    if (next === 'desk' && selected)
      void controls.moveTo(selected.x, LOOK_HEIGHT, selected.z, isAnimated)
    if (next === 'building') {
      const overview = latestRef.current.framing
      void controls.moveTo(...overview.target, isAnimated)
      void controls.zoomTo(overview.zoom, isAnimated)
    } else {
      if (next === 'floor') void controls.moveTo(0, 0, 0, isAnimated)
      void controls.zoomTo(BAND_ZOOM[next], isAnimated)
    }
  }).current

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    if (bandRef.current === 'desk') setBand('floor')
    const overview = latestRef.current.framing
    const target: [number, number, number] =
      bandRef.current === 'building' ? overview.target : [0, 0, 0]
    void controls.moveTo(...target, latestRef.current.isAnimated)
    void controls.zoomTo(
      bandRef.current === 'building' ? overview.zoom : BAND_ZOOM[bandRef.current],
      latestRef.current.isAnimated
    )
  }, [floor.floorId, setBand])

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls || bandRef.current !== 'building') return
    const overview = latestRef.current.framing
    void controls.moveTo(...overview.target, latestRef.current.isAnimated)
    void controls.zoomTo(overview.zoom, latestRef.current.isAnimated)
  }, [floorCount, size.width, size.height, floor.width, floor.depth])

  useEffect(() => {
    const step = createWheelStepper({ threshold: WHEEL_THRESHOLD, cooldownMs: WHEEL_COOLDOWN_MS })
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const direction = step(event.deltaY, performance.now())
      if (direction) stepZoomBand(direction)
    }
    domElement.addEventListener('wheel', onWheel, { passive: false })
    return () => domElement.removeEventListener('wheel', onWheel)
  }, [domElement, stepZoomBand])

  useEffect(() => {
    const controls = controlsRef.current
    if (!request || !controls) return
    const { isAnimated } = latestRef.current
    if (request.kind === 'zoom') return stepZoomBand(request.direction)
    if (request.kind === 'rotate') {
      void controls.rotateTo(
        snapAzimuth(controls.azimuthAngle, request.direction),
        ISO_POLAR,
        isAnimated
      )
      return
    }
    const agent = latestRef.current.agents.find(
      (candidate) => candidate.agentKey === request.agentKey
    )
    if (!agent) return
    setBand('desk')
    void controls.moveTo(agent.x, LOOK_HEIGHT, agent.z, isAnimated)
    void controls.zoomTo(BAND_ZOOM.desk, isAnimated)
  }, [request, setBand, stepZoomBand])

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minPolarAngle={ISO_POLAR}
      maxPolarAngle={ISO_POLAR}
      minZoom={framing.zoom * 0.8}
      maxZoom={BAND_ZOOM.desk * 1.2}
      smoothTime={0.3}
    />
  )
}
