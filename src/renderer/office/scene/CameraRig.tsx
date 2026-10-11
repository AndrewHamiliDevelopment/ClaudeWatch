import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import type { AgentView } from '../../../shared/office/types'
import {
  BAND_ZOOM,
  bandForZoom,
  buildingFraming,
  followAnchor,
  followStep,
  ISO_POLAR,
  snapAzimuth,
  type FollowAnchor,
  type ZoomBand
} from '../logic/camera-bands'
import type { CameraRequest } from '../logic/office-reducer'
import {
  boundsOfZone,
  frameBounds,
  occupiedBounds,
  padBounds,
  type Bounds
} from '../logic/zone-framing'
import { findZone } from '../logic/zone-model'
import type { FloorGeometry } from '../scene-model'
import { useCameraGestures, type CameraGestures } from './use-camera-gestures'

const LOOK_HEIGHT = 0.6
// A lone office is framed no closer than this.
const FLOOR_MAX_ZOOM = 60
const ZONE_PADDING_M = 1
const KEY_ZOOM_STEP = 1.25
// With truckSpeed 1 a drag moves the floor exactly as far as the hand; this short ease only
// hides the steps between pointer events, and reduced motion drops it.
const DRAG_SMOOTH_SEC = 0.05
const { ACTION } = CameraControlsImpl

interface CameraRigProps {
  floorCount: number
  floor: FloorGeometry
  agents: readonly AgentView[]
  liveSessionKeys: ReadonlySet<string>
  selectedAgentKey: string | null
  request: CameraRequest | null
  isReducedMotion: boolean
  onBandChange: (band: ZoomBand) => void
}

// Isometric orthographic camera: fixed 35° elevation, drag pans, wheel and pinch zoom toward the
// cursor, Q/E turn 90°. The zoom band is a level of detail read off the zoom each frame. Fly-to
// cuts instead of gliding under prefers-reduced-motion.
export function CameraRig(props: CameraRigProps) {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const gesturesRef = useRef<CameraGestures | null>(null)
  const bandRef = useRef<ZoomBand>('floor')
  const bandZoomRef = useRef(Number.NaN)
  const followRef = useRef<FollowAnchor | null>(null)
  // The camera frames the occupied floor by itself only until the owner moves it; Fit re-arms.
  const isAutoFramingRef = useRef(true)
  const targetScratch = useMemo(() => new Vector3(), [])
  const size = useThree((state) => state.size)
  const camera = useThree((state) => state.camera)
  const occupied = useMemo(
    () => occupiedBounds(props.floor, props.liveSessionKeys),
    [props.floor, props.liveSessionKeys]
  )
  const latestRef = useRef({ ...props, size, occupied, isAnimated: !props.isReducedMotion })
  latestRef.current = { ...props, size, occupied, isAnimated: !props.isReducedMotion }

  // Stable helpers that read the latest props through the ref.
  const rig = useRef({
    takeOver(): void {
      isAutoFramingRef.current = false
    },
    frame(bounds: Bounds, maxZoom: number): void {
      const controls = controlsRef.current
      if (!controls) return
      gesturesRef.current?.cancel()
      const { size: viewport, isAnimated } = latestRef.current
      const view = frameBounds(bounds, viewport, { azimuth: controls.azimuthAngle, maxZoom })
      void controls.moveTo(...view.target, isAnimated)
      void controls.zoomTo(view.zoom, isAnimated)
    },
    frameFloor(): void {
      rig.frame(latestRef.current.occupied, FLOOR_MAX_ZOOM)
    },
    fit(): void {
      isAutoFramingRef.current = true
      followRef.current = null
      rig.frameFloor()
    },
    floorFitZoom(): number {
      const { occupied: bounds, size: viewport } = latestRef.current
      const azimuth = controlsRef.current?.azimuthAngle ?? 0
      return frameBounds(bounds, viewport, { azimuth, maxZoom: FLOOR_MAX_ZOOM }).zoom
    }
  }).current

  gesturesRef.current = useCameraGestures({
    controlsRef,
    isReducedMotion: props.isReducedMotion,
    onManualMove: rig.takeOver,
    onFit: rig.fit
  })

  useEffect(() => {
    const controls = controlsRef.current
    if (!controls) return
    controls.mouseButtons.left = ACTION.TRUCK
    // Right-drag (two fingers on touch) turns the map; min = max polar keeps the elevation locked.
    controls.mouseButtons.right = ACTION.ROTATE
    controls.mouseButtons.middle = ACTION.NONE
    controls.mouseButtons.wheel = ACTION.NONE
    controls.touches.one = ACTION.TOUCH_TRUCK
    controls.touches.two = ACTION.TOUCH_ROTATE
    controls.touches.three = ACTION.NONE
    controls.truckSpeed = 1
    controls.addEventListener('controlstart', rig.takeOver)
    return () => controls.removeEventListener('controlstart', rig.takeOver)
  }, [rig])

  const { isReducedMotion } = props
  useEffect(() => {
    if (controlsRef.current)
      controlsRef.current.draggingSmoothTime = isReducedMotion ? 0 : DRAG_SMOOTH_SEC
  }, [isReducedMotion])

  // Frame the occupied area on the first snapshot, an arrival or departure, and a resize, but
  // only until the owner has moved the camera: after that it is theirs until they press Fit.
  const occupiedKey = `${props.floor.floorId}:${Object.values(occupied).map(Math.round).join(',')}`
  useEffect(() => {
    bandZoomRef.current = Number.NaN
    if (isAutoFramingRef.current) rig.frameFloor()
  }, [occupiedKey, size.width, size.height, rig])

  // The fit that separates floor from building depends on this floor, so the band is re-read
  // whenever the zoom moves (or the effect above resets the cache).
  useFrame(() => {
    if (camera.zoom === bandZoomRef.current) return
    bandZoomRef.current = camera.zoom
    const band = bandForZoom(camera.zoom, bandRef.current, rig.floorFitZoom())
    if (band === bandRef.current) return
    // Zooming out of the desk level ends the desk follow.
    if (bandRef.current === 'desk') followRef.current = null
    bandRef.current = band
    latestRef.current.onBandChange(band)
  })

  // At desk zoom, keep the followed agent's office in view when the floor re-packs. Only a room
  // that actually moved shifts the target, so the owner's own pan is never interrupted.
  const { floor: followedFloor, agents: followedAgents } = props
  useEffect(() => {
    const controls = controlsRef.current
    const anchor = followRef.current
    if (!controls || !anchor || bandRef.current !== 'desk') return
    const step = followStep(anchor, followedAgents, followedFloor.rooms)
    if (step.kind === 'stay') return
    if (step.kind === 'lost') return rig.fit()
    followRef.current = step.anchor
    const target = controls.getTarget(targetScratch)
    void controls.moveTo(
      target.x + step.dx,
      target.y,
      target.z + step.dz,
      latestRef.current.isAnimated
    )
  }, [followedFloor, followedAgents, rig, targetScratch])

  const { request } = props
  useEffect(() => {
    const controls = controlsRef.current
    if (!request || !controls) return
    const { isAnimated, floor, agents } = latestRef.current
    switch (request.kind) {
      case 'zoom':
        gesturesRef.current?.zoomBy(request.direction === 'in' ? KEY_ZOOM_STEP : 1 / KEY_ZOOM_STEP)
        return
      case 'rotate':
        rig.takeOver()
        void controls.rotateTo(
          snapAzimuth(controls.azimuthAngle, request.direction),
          ISO_POLAR,
          isAnimated
        )
        return
      case 'zone': {
        const zone = findZone(floor, request.zoneId)
        if (!zone) return
        rig.takeOver()
        followRef.current = null
        return rig.frame(padBounds(boundsOfZone(zone), ZONE_PADDING_M), BAND_ZOOM.desk)
      }
      case 'fly': {
        const agent = agents.find((candidate) => candidate.agentKey === request.agentKey)
        if (!agent) return
        rig.takeOver()
        gesturesRef.current?.cancel()
        followRef.current = followAnchor(agent, floor.rooms)
        void controls.moveTo(agent.x, LOOK_HEIGHT, agent.z, isAnimated)
        void controls.zoomTo(BAND_ZOOM.desk, isAnimated)
        return
      }
      default: {
        const unreachable: never = request
        return unreachable
      }
    }
  }, [request, rig])

  return (
    <CameraControls
      ref={controlsRef}
      makeDefault
      minPolarAngle={ISO_POLAR}
      maxPolarAngle={ISO_POLAR}
      minZoom={buildingFraming(props.floor, props.floorCount, size).zoom * 0.8}
      maxZoom={BAND_ZOOM.desk * 1.2}
      smoothTime={0.3}
    />
  )
}
