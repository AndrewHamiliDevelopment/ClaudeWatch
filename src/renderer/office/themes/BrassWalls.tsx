import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { CylinderGeometry, type InstancedMesh } from 'three'
import { floorWallSegments, WALL_HEIGHT_FULL, type WallsMode } from '../logic/room-layout'
import { createWallHeights } from '../logic/wall-heights'
import { STEAM } from '../office-palette'
import type { RoomGeometry } from '../scene-model'
import { writeInstances, type InstancePlacement } from '../scene/instancing'
import { Matte } from '../scene/InstancedParts'

const WALL_THICKNESS = 0.16
const PIPE_RADIUS = 0.07

interface WallsProps {
  rooms: readonly RoomGeometry[]
  mode: WallsMode
  isReducedMotion: boolean
}

// Low cream walls capped with a copper pipe; the camera position decides which cut away.
export function Walls({ rooms, mode, isReducedMotion }: WallsProps) {
  const wallRef = useRef<InstancedMesh>(null)
  const pipeRef = useRef<InstancedMesh>(null)
  const segments = useMemo(() => floorWallSegments(rooms), [rooms])
  const pipeGeometry = useMemo(
    () => new CylinderGeometry(PIPE_RADIUS, PIPE_RADIUS, 1, 8).rotateZ(Math.PI / 2),
    []
  )
  const wallHeights = useRef(createWallHeights(WALL_HEIGHT_FULL)).current

  useFrame(({ camera }, delta) => {
    if (!wallRef.current || !pipeRef.current) return
    // Settled walls under a still camera need no new instance matrices.
    if (!wallHeights.step(segments, mode, camera.position, delta, isReducedMotion)) return
    const walls: InstancePlacement[] = []
    const pipes: InstancePlacement[] = []
    segments.forEach((segment, index) => {
      const height = wallHeights.heights[index]
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
