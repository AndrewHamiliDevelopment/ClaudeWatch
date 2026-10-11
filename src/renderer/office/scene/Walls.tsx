import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CylinderGeometry, type InstancedMesh } from 'three'
import { approach } from '../logic/character-pose'
import {
  roomWallSegments,
  wallHeight,
  WALL_HEIGHT_FULL,
  type WallsMode
} from '../logic/room-layout'
import { STEAM } from '../office-palette'
import type { RoomGeometry } from '../scene-model'
import { writeInstances, type InstancePlacement } from './instancing'
import { Matte } from './InstancedParts'

const WALL_THICKNESS = 0.16
const PIPE_RADIUS = 0.07
const WALL_LOWER_RATE = 10

interface WallsProps {
  rooms: readonly RoomGeometry[]
  mode: WallsMode
  isReducedMotion: boolean
}

// Low cream walls capped with a copper pipe. Heights ease toward their target each frame and
// the camera position decides which walls cut away.
export function Walls({ rooms, mode, isReducedMotion }: WallsProps) {
  const wallRef = useRef<InstancedMesh>(null)
  const pipeRef = useRef<InstancedMesh>(null)
  const segments = useMemo(() => rooms.flatMap(roomWallSegments), [rooms])
  const pipeGeometry = useMemo(
    () => new CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, 1, 8).rotateZ(Math.PI / 2),
    []
  )
  const heightsRef = useRef<number[]>([])

  useFrame(({ camera }, delta) => {
    if (!wallRef.current || !pipeRef.current) return
    const heights = heightsRef.current
    const walls: InstancePlacement[] = []
    const pipes: InstancePlacement[] = []
    segments.forEach((segment, index) => {
      const target = wallHeight(mode, segment, { x: camera.position.x, z: camera.position.z })
      const height = isReducedMotion
        ? target
        : approach(heights[index] ?? WALL_HEIGHT_FULL, target, delta, WALL_LOWER_RATE)
      heights[index] = height
      const rotationY = segment.normalZ === 0 ? Math.PI / 2 : 0
      const length = segment.length + WALL_THICKNESS
      walls.push({
        x: segment.x,
        y: height / 2,
        z: segment.z,
        rotationY,
        scaleX: length,
        scaleY: height
      })
      pipes.push({ x: segment.x, y: height, z: segment.z, rotationY, scaleX: length })
    })
    heights.length = segments.length
    writeInstances(wallRef.current, walls)
    writeInstances(pipeRef.current, pipes)
  })

  const count = Math.max(segments.length, 1)
  return (
    <>
      <instancedMesh
        key={`wall-${count}`}
        ref={wallRef}
        args={[undefined, undefined, count]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, WALL_THICKNESS]} />
        <Matte color={STEAM.cream} />
      </instancedMesh>
      <instancedMesh
        key={`pipe-${count}`}
        ref={pipeRef}
        args={[pipeGeometry, undefined, count]}
        frustumCulled={false}
      >
        <Matte color={STEAM.copper} />
      </instancedMesh>
    </>
  )
}
