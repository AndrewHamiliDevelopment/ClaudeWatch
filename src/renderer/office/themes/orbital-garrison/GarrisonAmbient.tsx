import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { Group } from 'three'
import type { FloorGeometry } from '../../scene-model'
import { Parts } from '../parts'
import type { AmbientProps } from '../types'
import {
  CIRCUIT_ALTITUDE_M,
  circuitLength,
  circuitPose,
  DISH,
  radarMounts,
  SHUTTLE
} from './ambient'
import type { RadarMount } from './lots'

const DISH_TURN_RAD_S = 0.6
const SHUTTLE_SPEED_M_S = 7

// Movers only set their own transform: the scene paces frames, so nothing here asks for one.
export function RadarDish({
  mount,
  isReducedMotion
}: {
  mount: RadarMount
  isReducedMotion: boolean
}) {
  const dish = useRef<Group>(null)
  useFrame(({ clock }) => {
    if (isReducedMotion || !dish.current) return
    dish.current.rotation.y = clock.elapsedTime * DISH_TURN_RAD_S
  })
  return (
    <group ref={dish} position={[mount.x, mount.y, mount.z]} scale={mount.scale}>
      <Parts parts={DISH} />
    </group>
  )
}

export function Shuttle({
  floor,
  isReducedMotion
}: {
  floor: FloorGeometry
  isReducedMotion: boolean
}) {
  const craft = useRef<Group>(null)
  const start = circuitPose(floor, 0)
  useFrame(({ clock }) => {
    if (isReducedMotion || !craft.current) return
    const laps = (clock.elapsedTime * SHUTTLE_SPEED_M_S) / circuitLength(floor)
    const pose = circuitPose(floor, laps % 1)
    craft.current.position.set(pose.x, CIRCUIT_ALTITUDE_M, pose.z)
    craft.current.rotation.y = pose.heading
  })
  return (
    <group
      ref={craft}
      position={[start.x, CIRCUIT_ALTITUDE_M, start.z]}
      rotation={[0, start.heading, 0]}
    >
      <Parts parts={SHUTTLE} />
    </group>
  )
}

// A dish turning on every radar tower drawn, and a shuttle flying circuits over the runway.
export function GarrisonAmbient({ floor, placed = [], isReducedMotion }: AmbientProps) {
  const mounts = useMemo(() => radarMounts(placed), [placed])
  return (
    <>
      {mounts.map((mount) => (
        <RadarDish key={`${mount.x}:${mount.z}`} mount={mount} isReducedMotion={isReducedMotion} />
      ))}
      <Shuttle floor={floor} isReducedMotion={isReducedMotion} />
    </>
  )
}
