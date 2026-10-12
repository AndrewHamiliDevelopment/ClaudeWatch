import { CameraControlsImpl, Html } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Vector3, type Group } from 'three'
import type { AgentView } from '../../../shared/office/types'
import { ISO_START_AZIMUTH } from '../logic/camera-bands'
import { projectToScreen, screenAxes } from '../logic/zone-framing'
import type { FloorGeometry } from '../scene-model'
import { BEFORE_CONTROLS } from '../scene/use-camera-gestures'
import { isStillClick, trackPress } from '../scene/ZonePickers'
import { GROUND_Y, sceneExtent, type Lot } from '../themes/surroundings'
import type { ThemePalette } from '../themes/types'
import { followStep } from './camera-follow'
import { playerGeometry } from './figure'
import { TalkPrompt } from './TalkPrompt'
import { groundHeight, walkGround, walkPath } from './walk-ground'
import { listenForWalkKeys } from './walk-keys'
import { agentInReach, MAX_FRAME_SEC, sendPlayer, tickPlayer, type Player } from './walking'

interface PlayerLayerProps {
  player: Player
  isWalking: boolean
  floor: FloorGeometry
  // Everything that stands on the ground: the ring's lots and the floor theme's district.
  solids: readonly Lot[]
  agents: readonly AgentView[]
  palette: ThemePalette
  isReducedMotion: boolean
  onSelectAgent: (agentKey: string) => void
}

const FLAT = -Math.PI / 2
// Just under the zone plates, which catch a click on an office first.
const PLATE_PICK_Y = 0.01
const TURN_PER_SEC = 14
const STRIDE_M = 0.7
const BOB_M = 0.05
// Above the agent's name card, which the prompt must not cover.
const PROMPT_Y = 3.7
// The first frame of a walk reports the idle gap before it: it is walked as one display frame.
const FIRST_FRAME_SEC = 1 / 60
const CAMERA_INPUTS = ['pointerdown', 'wheel'] as const

function turnToward(from: number, to: number, share: number): number {
  const gap = Math.atan2(Math.sin(to - from), Math.cos(to - from))
  return from + gap * Math.min(1, share)
}

// The owner's character, the ground it can be sent across, and the camera that goes with it.
// It asks for a frame only while it moves; standing, it costs nothing but its one draw.
export function PlayerLayer(props: PlayerLayerProps) {
  const { player, isWalking, floor, solids, agents, palette } = props
  const invalidate = useThree((state) => state.invalidate)
  const figureRef = useRef<Group>(null)
  const strideRef = useRef(0)
  const wasMovingRef = useRef(false)
  // The camera is still sweeping to the player; ended by the owner's hand on the camera.
  const isFollowingRef = useRef(false)
  const target = useMemo(() => new Vector3(), [])
  const ground = useMemo(() => walkGround(floor, solids), [floor, solids])
  const extent = useMemo(() => sceneExtent(floor, solids), [floor, solids])
  const geometry = useMemo(() => playerGeometry(palette), [palette])
  useEffect(() => () => geometry.dispose(), [geometry])
  const [nearAgent, setNearAgent] = useState<AgentView | null>(null)
  const latest = { ...props, nearAgent }
  const latestRef = useRef(latest)
  latestRef.current = latest

  const place = (heading: number, lift: number): void => {
    const figure = figureRef.current
    if (!figure) return
    const { x, z } = player.position
    figure.position.set(x, groundHeight(latestRef.current.floor, player.position) + lift, z)
    figure.rotation.y = heading
  }

  useLayoutEffect(() => {
    place(player.heading, 0)
    invalidate()
    // `floor` is here so it is placed again when the floor re-packs under it.
  }, [player, floor, invalidate])

  useEffect(() => {
    player.onGoal = invalidate
    return () => {
      player.onGoal = null
    }
  }, [player, invalidate])

  useEffect(() => {
    if (!isWalking) {
      // Walking off: it stands where it was left.
      player.path = []
      player.goal = null
      return
    }
    const stopFollowing = (): void => {
      isFollowingRef.current = false
    }
    // Taking the player, by the switch or by a key, brings the camera to it even before it moves.
    const follow = (): void => {
      isFollowingRef.current = true
      invalidate()
    }
    follow()
    for (const type of CAMERA_INPUTS) window.addEventListener(type, stopFollowing)
    const stopListening = listenForWalkKeys({
      player,
      onTalk: () => {
        const beside = latestRef.current.nearAgent
        if (beside) latestRef.current.onSelectAgent(beside.agentKey)
      },
      onChange: follow
    })
    return () => {
      for (const type of CAMERA_INPUTS) window.removeEventListener(type, stopFollowing)
      stopListening()
    }
  }, [isWalking, player, invalidate])

  // Agents walk too: one that comes up to a standing player is offered as well.
  useEffect(() => {
    setNearAgent(isWalking ? agentInReach(player.position, agents) : null)
  }, [isWalking, agents, player])

  useFrame((state, deltaSec) => {
    const { isReducedMotion } = latestRef.current
    if (!latestRef.current.isWalking) return
    if (player.goal) {
      player.path = walkPath(ground, player.position, player.goal).slice(1)
      player.goal = null
    }
    const controls = state.controls instanceof CameraControlsImpl ? state.controls : null
    const azimuth = controls?.azimuthAngle ?? ISO_START_AZIMUTH
    const before = player.position
    const frameSec = Math.min(deltaSec, wasMovingRef.current ? MAX_FRAME_SEC : FIRST_FRAME_SEC)
    const hasMoved = tickPlayer(player, ground, frameSec, azimuth)
    const figure = figureRef.current
    if (hasMoved) {
      isFollowingRef.current = true
      strideRef.current += Math.hypot(player.position.x - before.x, player.position.z - before.z)
      if (isReducedMotion || !figure) place(player.heading, 0)
      else
        place(
          turnToward(figure.rotation.y, player.heading, frameSec * TURN_PER_SEC),
          Math.abs(Math.sin((strideRef.current / STRIDE_M) * Math.PI)) * BOB_M
        )
      const beside = agentInReach(player.position, latestRef.current.agents)
      if (beside?.agentKey !== latestRef.current.nearAgent?.agentKey) setNearAgent(beside)
    } else if (strideRef.current !== 0) {
      // The frame after the last step: drop the bob and finish the turn.
      place(player.heading, 0)
      strideRef.current = 0
    }

    if (isFollowingRef.current && controls) {
      controls.getTarget(target, false)
      const zoom = state.camera.zoom
      const step = followStep({
        onScreen: projectToScreen(
          {
            x: player.position.x,
            y: groundHeight(latestRef.current.floor, player.position),
            z: player.position.z
          },
          { target: [target.x, target.y, target.z], zoom, azimuth },
          state.size
        ),
        viewport: state.size,
        zoom,
        deltaSec: frameSec,
        isReducedMotion
      })
      if (step.right !== 0 || step.down !== 0) {
        const axes = screenAxes(azimuth)
        void controls.moveTo(
          target.x + axes.right[0] * step.right - axes.up[0] * step.down,
          target.y + axes.right[1] * step.right - axes.up[1] * step.down,
          target.z + axes.right[2] * step.right - axes.up[2] * step.down,
          false
        )
      }
      // Standing still, the sweep ends once the player is back in view.
      if (step.isSettled && !hasMoved) isFollowingRef.current = false
    }
    // Only movement asks for the next frame: a standing player with a settled camera asks for none.
    wasMovingRef.current = hasMoved || isFollowingRef.current
    if (wasMovingRef.current) invalidate()
  }, BEFORE_CONTROLS)

  const walkHere = (event: ThreeEvent<MouseEvent>): void => {
    if (!isStillClick(event)) return
    event.stopPropagation()
    sendPlayer(player, event.point)
  }
  const plate = { x: floor.x, z: floor.z }
  return (
    <>
      <group ref={figureRef}>
        <mesh geometry={geometry} frustumCulled={false}>
          <meshStandardMaterial vertexColors roughness={0.8} metalness={0.15} />
        </mesh>
      </group>
      {isWalking && (
        <>
          <mesh
            position={[extent.x, GROUND_Y, extent.z]}
            rotation={[FLAT, 0, 0]}
            onPointerDown={trackPress}
            onClick={walkHere}
          >
            <planeGeometry args={[extent.width, extent.depth]} />
            <meshBasicMaterial visible={false} />
          </mesh>
          <mesh
            position={[plate.x, PLATE_PICK_Y, plate.z]}
            rotation={[FLAT, 0, 0]}
            onPointerDown={trackPress}
            onClick={walkHere}
          >
            <planeGeometry args={[floor.width, floor.depth]} />
            <meshBasicMaterial visible={false} />
          </mesh>
        </>
      )}
      {nearAgent && (
        <Html position={[nearAgent.x, PROMPT_Y, nearAgent.z]} center zIndexRange={[20, 0]}>
          <TalkPrompt label={nearAgent.label} />
        </Html>
      )}
    </>
  )
}
