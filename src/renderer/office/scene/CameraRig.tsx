import { CameraControls, CameraControlsImpl } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import type { AgentView } from '../../../shared/office/types'
import {
  BAND_ZOOM,
  buildingFraming,
  createWheelStepper,
  followAnchor,
  followStep,
  ISO_POLAR,
  snapAzimuth,
  stepBand,
  type FollowAnchor,
  type ZoomBand,
  type ZoomDirection
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

const LOOK_HEIGHT = 0.6
const WHEEL_THRESHOLD = 40
const WHEEL_COOLDOWN_MS = 320
// A lone office is framed no closer than this, so the floor band never jumps to desk scale.
const FLOOR_MAX_ZOOM = 60
const ZONE_PADDING_M = 1
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

// Isometric orthographic camera: fixed 35° elevation, drag pans, wheel or -/= snap between three
// zoom bands, Q/E turn 90°. The floor band frames the occupied offices inside the area the HUD
// leaves free; fly-to cuts instead of gliding under prefers-reduced-motion.
export function CameraRig(props: CameraRigProps) {
  const controlsRef = useRef<CameraControlsImpl>(null)
  const bandRef = useRef<ZoomBand>('floor')
  const followRef = useRef<FollowAnchor | null>(null)
  const targetScratch = useMemo(() => new Vector3(), [])
  const size = useThree((state) => state.size)
  const domElement = useThree((state) => state.gl.domElement)
  const occupied = useMemo(
    () => occupiedBounds(props.floor, props.liveSessionKeys),
    [props.floor, props.liveSessionKeys]
  )
  const latestRef = useRef({ ...props, size, occupied, isAnimated: !props.isReducedMotion })
  latestRef.current = { ...props, size, occupied, isAnimated: !props.isReducedMotion }

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
  }, [])

  // Stable helpers that read the latest props through the ref.
  const rig = useRef({
    setBand(band: ZoomBand): void {
      bandRef.current = band
      if (band !== 'desk') followRef.current = null
      latestRef.current.onBandChange(band)
    },
    frame(bounds: Bounds, maxZoom: number): void {
      const controls = controlsRef.current
      if (!controls) return
      const { size: viewport, isAnimated } = latestRef.current
      const view = frameBounds(bounds, viewport, { azimuth: controls.azimuthAngle, maxZoom })
      void controls.moveTo(...view.target, isAnimated)
      void controls.zoomTo(view.zoom, isAnimated)
    },
    frameFloor(): void {
      rig.frame(latestRef.current.occupied, FLOOR_MAX_ZOOM)
    },
    frameBuilding(): void {
      const controls = controlsRef.current
      if (!controls) return
      const { floor, floorCount, size: viewport, isAnimated } = latestRef.current
      const overview = buildingFraming(floor, floorCount, viewport)
      void controls.moveTo(...overview.target, isAnimated)
      void controls.zoomTo(overview.zoom, isAnimated)
    },
    stepZoom(direction: ZoomDirection): void {
      const controls = controlsRef.current
      const next = stepBand(bandRef.current, direction)
      if (!controls || next === bandRef.current) return
      rig.setBand(next)
      if (next === 'building') return rig.frameBuilding()
      if (next === 'floor') return rig.frameFloor()
      const { agents, selectedAgentKey, isAnimated } = latestRef.current
      const selected = agents.find((agent) => agent.agentKey === selectedAgentKey)
      if (selected) void controls.moveTo(selected.x, LOOK_HEIGHT, selected.z, isAnimated)
      followRef.current = selected ? followAnchor(selected, latestRef.current.floor.rooms) : null
      void controls.zoomTo(BAND_ZOOM.desk, isAnimated)
    }
  }).current

  // Re-frame when the occupied area changes (first snapshot, an agent arriving or leaving),
  // unless the owner has zoomed to a desk or out to the building.
  const occupiedKey = `${props.floor.floorId}:${Object.values(occupied).map(Math.round).join(',')}`
  useEffect(() => {
    if (bandRef.current === 'floor') rig.frameFloor()
  }, [occupiedKey, rig])

  // At desk zoom, keep the followed agent's office in view when the floor re-packs. Only a room
  // that actually moved shifts the target, so the owner's own pan is never interrupted.
  const { floor: followedFloor, agents: followedAgents } = props
  useEffect(() => {
    const controls = controlsRef.current
    const anchor = followRef.current
    if (!controls || !anchor || bandRef.current !== 'desk') return
    const step = followStep(anchor, followedAgents, followedFloor.rooms)
    if (step.kind === 'stay') return
    if (step.kind === 'lost') {
      rig.setBand('floor')
      return rig.frameFloor()
    }
    followRef.current = step.anchor
    const target = controls.getTarget(targetScratch)
    void controls.moveTo(
      target.x + step.dx,
      target.y,
      target.z + step.dz,
      latestRef.current.isAnimated
    )
  }, [followedFloor, followedAgents, rig, targetScratch])

  useEffect(() => {
    if (bandRef.current === 'building') rig.frameBuilding()
    if (bandRef.current === 'floor') rig.frameFloor()
  }, [props.floorCount, size.width, size.height, rig])

  useEffect(() => {
    const step = createWheelStepper({ threshold: WHEEL_THRESHOLD, cooldownMs: WHEEL_COOLDOWN_MS })
    const onWheel = (event: WheelEvent): void => {
      event.preventDefault()
      const direction = step(event.deltaY, performance.now())
      if (direction) rig.stepZoom(direction)
    }
    domElement.addEventListener('wheel', onWheel, { passive: false })
    return () => domElement.removeEventListener('wheel', onWheel)
  }, [domElement, rig])

  const { request } = props
  useEffect(() => {
    const controls = controlsRef.current
    if (!request || !controls) return
    const { isAnimated, floor, agents } = latestRef.current
    switch (request.kind) {
      case 'zoom':
        return rig.stepZoom(request.direction)
      case 'rotate':
        void controls.rotateTo(
          snapAzimuth(controls.azimuthAngle, request.direction),
          ISO_POLAR,
          isAnimated
        )
        return
      case 'zone': {
        const zone = findZone(floor, request.zoneId)
        if (!zone) return
        rig.setBand('floor')
        return rig.frame(padBounds(boundsOfZone(zone), ZONE_PADDING_M), BAND_ZOOM.desk)
      }
      case 'fly': {
        const agent = agents.find((candidate) => candidate.agentKey === request.agentKey)
        if (!agent) return
        rig.setBand('desk')
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
