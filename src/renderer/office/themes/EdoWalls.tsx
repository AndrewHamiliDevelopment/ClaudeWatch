import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { InstancedMesh } from 'three'
import { roomWallSegments } from '../logic/room-layout'
import { createWallHeights } from '../logic/wall-heights'
import { writeInstances, type InstancePlacement } from '../scene/instancing'
import { Matte } from '../scene/InstancedParts'
import { EDO } from './palettes'
import { shojiParts } from './shoji-layout'
import type { WallsProps } from './types'

export function EdoWalls({ floor, mode, isReducedMotion }: WallsProps) {
  const panels = useRef<InstancedMesh>(null)
  const lattice = useRef<InstancedMesh>(null)
  const pipes = useRef<InstancedMesh>(null)
  const gauges = useRef<InstancedMesh>(null)
  const wallHeights = useRef(createWallHeights()).current
  const segments = useMemo(() => floor.rooms.flatMap(roomWallSegments), [floor.rooms])
  const latticeCount = segments.reduce((count, s) => count + Math.ceil(s.length / 0.5) + 4, 0)
  useFrame(({ camera }, delta) => {
    if (!panels.current || !lattice.current || !pipes.current || !gauges.current) return
    // Settled walls under a still camera need no new instance matrices.
    if (!wallHeights.step(segments, mode, camera.position, delta, isReducedMotion)) return
    const paper: InstancePlacement[] = []
    const bars: InstancePlacement[] = []
    const copper: InstancePlacement[] = []
    const dials: InstancePlacement[] = []
    segments.forEach((segment, index) => {
      const parts = shojiParts(segment, wallHeights.heights[index])
      paper.push(parts.panel)
      bars.push(...parts.bars)
      copper.push(parts.pipe)
      dials.push(parts.dial)
    })
    writeInstances(panels.current, paper)
    writeInstances(lattice.current, bars)
    writeInstances(pipes.current, copper)
    writeInstances(gauges.current, dials)
  })
  return (
    <>
      <instancedMesh
        key={`paper-${segments.length}`}
        ref={panels}
        args={[undefined, undefined, Math.max(1, segments.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 1, 0.04]} />
        <meshStandardMaterial
          color={EDO.paper}
          transparent
          opacity={0.78}
          roughness={1}
          depthWrite={false}
        />
      </instancedMesh>
      <instancedMesh
        key={`lattice-${latticeCount}`}
        ref={lattice}
        args={[undefined, undefined, Math.max(1, latticeCount)]}
        frustumCulled={false}
      >
        <boxGeometry args={[0.035, 1, 0.07]} />
        <Matte color={EDO.wood} />
      </instancedMesh>
      <instancedMesh
        key={`pipe-${segments.length}`}
        ref={pipes}
        args={[undefined, undefined, Math.max(1, segments.length)]}
        frustumCulled={false}
      >
        <boxGeometry args={[1, 0.065, 0.065]} />
        <Matte color={EDO.copper} />
      </instancedMesh>
      <instancedMesh
        key={`gauge-${segments.length}`}
        ref={gauges}
        args={[undefined, undefined, Math.max(1, segments.length)]}
        frustumCulled={false}
      >
        <sphereGeometry args={[0.085, 8, 6]} />
        <Matte color={EDO.paper} />
      </instancedMesh>
    </>
  )
}
