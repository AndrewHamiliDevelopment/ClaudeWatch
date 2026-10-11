import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useLayoutEffect, useMemo, useRef } from 'react'
import type { Group, Mesh, MeshStandardMaterial } from 'three'
import type { AgentView } from '../../../shared/office/types'
import { approach, approachAngle, moodFor, robotPose, steamPuffs } from '../logic/character-pose'
import { ROBOT_PALETTE, STATE_COLOR, STEAM } from '../office-palette'
import { Matte } from './InstancedParts'
import { blobShadowTexture } from './textures'

// Sized up from the 1 m desk scale so robots read at the floor zoom band.
const ROBOT_SCALE = 1.3
const SUBAGENT_SCALE = 0.9
const MOVE_RATE = 5
const TURN_RATE = 6
const MOVING_EPSILON = 0.05
const RIVET_HEIGHTS = [0.55, 0.45, 0.35]
const THOUGHT_DOTS = [-0.09, 0, 0.09]

interface RobotProps {
  agent: AgentView
  isSelected: boolean
  isReducedMotion: boolean
  onSelect: (agentKey: string) => void
  onFly: (agentKey: string) => void
}

function phaseFor(key: string): number {
  let hash = 0
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return (hash % 1000) / 1000
}

// A small steampunk mecha from primitives: brass body, domed head with a visor eye, a back gear
// that spins while working, two arms, a hover base and a head vent that puffs steam.
export function Robot({ agent, isSelected, isReducedMotion, onSelect, onFly }: RobotProps) {
  const palette = ROBOT_PALETTE[agent.provider]
  const parts = {
    root: useRef<Group>(null),
    body: useRef<Group>(null),
    head: useRef<Group>(null),
    gear: useRef<Group>(null),
    leftArm: useRef<Group>(null),
    rightArm: useRef<Group>(null),
    eye: useRef<Mesh>(null),
    thought: useRef<Group>(null),
    puffs: [useRef<Mesh>(null), useRef<Mesh>(null), useRef<Mesh>(null)],
    puffMaterials: [
      useRef<MeshStandardMaterial>(null),
      useRef<MeshStandardMaterial>(null),
      useRef<MeshStandardMaterial>(null)
    ]
  }
  const agentRef = useRef(agent)
  agentRef.current = agent
  const phase = useMemo(() => phaseFor(agent.agentKey), [agent.agentKey])

  useLayoutEffect(() => {
    const root = parts.root.current
    if (!root) return
    root.position.set(agentRef.current.x, 0, agentRef.current.z)
    root.rotation.y = agentRef.current.heading
    // Seeds the first position only; later frames ease toward the target.
  }, [parts.root])

  // Per-frame motion mutates refs only; React re-renders only when the feed sends a new frame.
  useFrame(({ clock }, delta) => {
    const root = parts.root.current
    const body = parts.body.current
    if (!root || !body) return
    const target = agentRef.current
    const isMoving =
      Math.hypot(root.position.x - target.x, root.position.z - target.z) > MOVING_EPSILON
    root.position.x = approach(root.position.x, target.x, delta, MOVE_RATE)
    root.position.z = approach(root.position.z, target.z, delta, MOVE_RATE)
    root.rotation.y = approachAngle(root.rotation.y, target.heading, delta, TURN_RATE)
    const mood = moodFor(target, isMoving)
    const pose = robotPose(mood, clock.elapsedTime, phase, { isReducedMotion })
    body.position.y = pose.bob
    body.rotation.z = pose.sway
    parts.head.current?.rotation.set(pose.headPitch, 0, 0)
    parts.leftArm.current?.rotation.set(pose.leftArm, 0, 0)
    parts.rightArm.current?.rotation.set(pose.rightArm, 0, pose.rightArmRoll)
    if (parts.gear.current) parts.gear.current.rotation.z += pose.gearSpeed * delta
    parts.eye.current?.scale.set(1, pose.eyeOpen, 1)
    if (parts.thought.current) parts.thought.current.visible = mood === 'thinking'
    const puffs = mood === 'working' && !isReducedMotion ? steamPuffs(clock.elapsedTime, phase) : []
    parts.puffs.forEach((puffRef, index) => {
      const mesh = puffRef.current
      if (!mesh) return
      const puff = puffs[index]
      mesh.visible = Boolean(puff && puff.opacity > 0)
      if (!puff || !mesh.visible) return
      mesh.position.y = 1.12 + puff.y
      mesh.scale.setScalar(puff.scale)
      const material = parts.puffMaterials[index].current
      if (material) material.opacity = puff.opacity
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
    <group ref={parts.root} scale={agent.isSubagent ? SUBAGENT_SCALE : ROBOT_SCALE}>
      <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.9, 0.9]} />
        <meshBasicMaterial map={blobShadowTexture()} transparent depthWrite={false} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.52, 40]} />
          <meshBasicMaterial color={STATE_COLOR.working} toneMapped={false} />
        </mesh>
      )}
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.13, 0.18, 0.1, 12]} />
        <Matte color={STEAM.iron} />
      </mesh>
      <group ref={parts.body}>
        <mesh position={[0, 0.45, 0]}>
          <capsuleGeometry args={[0.2, 0.2, 4, 12]} />
          <Matte color={palette.body} />
        </mesh>
        {RIVET_HEIGHTS.map((y) => (
          <mesh key={y} position={[0, y, 0.2]}>
            <sphereGeometry args={[0.022, 6, 4]} />
            <Matte color={palette.trim} />
          </mesh>
        ))}
        <group ref={parts.gear} position={[0, 0.48, -0.21]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.04, 8]} />
            <Matte color={palette.trim} />
          </mesh>
          <mesh position={[0, 0.12, 0]}>
            <boxGeometry args={[0.05, 0.06, 0.04]} />
            <Matte color={palette.trim} />
          </mesh>
        </group>
        {(
          [
            ['left', -0.25, parts.leftArm],
            ['right', 0.25, parts.rightArm]
          ] as const
        ).map(([side, x, ref]) => (
          <group key={side} ref={ref} position={[x, 0.58, 0]}>
            <mesh position={[0, -0.14, 0]}>
              <capsuleGeometry args={[0.05, 0.18, 3, 8]} />
              <Matte color={palette.trim} />
            </mesh>
          </group>
        ))}
        <group ref={parts.head} position={[0, 0.8, 0]}>
          <mesh scale={[1, 0.85, 1]}>
            <sphereGeometry args={[0.17, 16, 12]} />
            <Matte color={palette.body} />
          </mesh>
          <mesh ref={parts.eye} position={[0, 0.01, 0.15]}>
            <boxGeometry args={[0.2, 0.055, 0.04]} />
            <Matte color={palette.eye} glow />
          </mesh>
          <mesh position={[0.07, 0.17, -0.05]}>
            <cylinderGeometry args={[0.03, 0.035, 0.1, 8]} />
            <Matte color={palette.trim} />
          </mesh>
        </group>
        {parts.puffs.map((puffRef, index) => (
          <mesh key={index} ref={puffRef} position={[0.07, 1.12, -0.05]} visible={false}>
            <sphereGeometry args={[1, 8, 6]} />
            <meshStandardMaterial
              ref={parts.puffMaterials[index]}
              color={STEAM.steam}
              transparent
              depthWrite={false}
              roughness={1}
            />
          </mesh>
        ))}
        <group ref={parts.thought} position={[0, 1.2, 0]} visible={false}>
          {THOUGHT_DOTS.map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <sphereGeometry args={[0.03, 8, 6]} />
              <meshBasicMaterial color={STEAM.steam} />
            </mesh>
          ))}
        </group>
      </group>
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
