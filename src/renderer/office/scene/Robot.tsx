import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { AgentView } from '../../../shared/office/types'
import { approach, approachAngle, moodFor, robotPose } from '../logic/character-pose'
import { applyThemePose, useRobotRig } from '../themes/rig'
import type { OfficeTheme } from '../themes/types'
import { blobShadowTexture } from './textures'

// Sized up from the 1 m desk scale so robots read at the floor zoom band.
const ROBOT_SCALE = 1.3
const SUBAGENT_SCALE = 0.9
const MOVE_RATE = 5
const TURN_RATE = 6
const MOVING_EPSILON = 0.05

interface RobotProps {
  theme: OfficeTheme
  agent: AgentView
  isSelected: boolean
  isSpeaking: boolean
  isReducedMotion: boolean
  onSelect: (agentKey: string) => void
  onFly: (agentKey: string) => void
}

function phaseFor(key: string): number {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (hash % 1000) / 1000
}

export function Robot({
  agent,
  theme,
  isSelected,
  isSpeaking,
  isReducedMotion,
  onSelect,
  onFly
}: RobotProps) {
  const rig = useRobotRig()
  const rootRef = useRef<Group>(null)
  const Model = theme.robot.Model
  const agentRef = useRef(agent)
  agentRef.current = agent
  const phase = useMemo(() => phaseFor(agent.agentKey), [agent.agentKey])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.position.set(agentRef.current.x, 0, agentRef.current.z)
    root.rotation.y = agentRef.current.heading
    // Seeds the first position only; later frames ease toward the target.
  }, [rootRef])

  // Per-frame motion mutates refs only; React re-renders only when the feed sends a new frame.
  useFrame(({ clock }, delta) => {
    const root = rootRef.current
    const body = rig.body.current
    if (!root || !body) return
    const target = agentRef.current
    const isMoving =
      Math.hypot(root.position.x - target.x, root.position.z - target.z) > MOVING_EPSILON
    root.position.x = approach(root.position.x, target.x, delta, MOVE_RATE)
    root.position.z = approach(root.position.z, target.z, delta, MOVE_RATE)
    root.rotation.y = approachAngle(root.rotation.y, target.heading, delta, TURN_RATE)
    const mood = moodFor(target, isMoving)
    const pose = robotPose(mood, clock.elapsedTime, phase, { isReducedMotion })
    applyThemePose(rig, pose, {
      mood,
      time: clock.elapsedTime,
      phase,
      delta,
      isReducedMotion
    })
  })

  const select = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation()
    onSelect(agent.agentKey)
  }
  const fly = (event: ThreeEvent<MouseEvent>): void => {
    event.stopPropagation()
    onFly(agent.agentKey)
  }

  return (
    <group ref={rootRef} scale={agent.isSubagent ? SUBAGENT_SCALE : ROBOT_SCALE}>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial map={blobShadowTexture()} transparent depthWrite={false} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.52, 40]} />
          <meshBasicMaterial color={theme.palette.glow} toneMapped={false} />
        </mesh>
      )}
      <Model
        agent={agent}
        skin={theme.robot.skins[agent.provider]}
        rig={rig}
        isReducedMotion={isReducedMotion}
      />
      {isSpeaking && (
        // Speech puff after a message is sent; OfficeApp clears it after about 1.5 s.
        <group position={[0.32, 1.32, 0]}>
          <mesh scale={[0.24, 0.16, 0.08]}>
            <sphereGeometry args={[1, 16, 10]} />
            <meshBasicMaterial color={theme.palette.steam} />
          </mesh>
          <mesh position={[-0.13, -0.13, 0]} scale={0.045}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshBasicMaterial color={theme.palette.steam} />
          </mesh>
        </group>
      )}
      {/* Invisible, simple hit target: raycasting one capsule beats raycasting every part. */}
      <mesh
        position={[0, 0.6, 0]}
        onClick={select}
        onDoubleClick={fly}
        onPointerOver={() => (document.body.style.cursor = 'pointer')}
        onPointerOut={() => (document.body.style.cursor = '')}
      >
        <capsuleGeometry args={[0.32, 0.6, 2, 8]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </group>
  )
}
