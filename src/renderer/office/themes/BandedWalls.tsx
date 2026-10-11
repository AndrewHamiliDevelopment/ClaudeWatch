import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { InstancedMesh } from 'three'
import { floorWallSegments, WALL_HEIGHT_FULL } from '../logic/room-layout'
import { createWallHeights } from '../logic/wall-heights'
import { Matte } from '../scene/InstancedParts'
import { writeInstances, type InstancePlacement } from '../scene/instancing'
import type { WallsProps } from './types'
import { UNIT_SHAPES } from './unit-parts'

export interface WallBand {
  name: string
  color: string
  thickness: number
  // Where the band sits on a wall that currently stands `height` tall.
  span: (height: number) => { y: number; scaleY: number }
}

// dry-new: the Edo and Brass walls bake their colours and sizes in; these are unit boxes, one
// instanced draw per band, so a theme's walls merge with the rest of its parts.
export function BandedWalls({
  bands,
  rooms,
  mode,
  isReducedMotion
}: WallsProps & { bands: readonly WallBand[] }) {
  const bandRefs = useRef<(InstancedMesh | null)[]>([])
  const segments = useMemo(() => floorWallSegments(rooms), [rooms])
  const wallHeights = useRef(createWallHeights(WALL_HEIGHT_FULL)).current

  useFrame(({ camera }, delta) => {
    if (bandRefs.current.filter(Boolean).length < bands.length) return
    // Settled walls under a still camera need no new instance matrices.
    if (!wallHeights.step(segments, mode, camera.position, delta, isReducedMotion)) return
    bands.forEach((band, bandIndex) => {
      const mesh = bandRefs.current[bandIndex]
      if (!mesh) return
      const placements: InstancePlacement[] = segments.map((segment, index) => ({
        x: segment.x,
        z: segment.z,
        rotationY: segment.normalZ === 0 ? Math.PI / 2 : 0,
        ...band.span(wallHeights.heights[index]),
        scaleX: segment.length + band.thickness,
        scaleZ: band.thickness
      }))
      writeInstances(mesh, placements)
    })
  })

  const count = Math.max(segments.length, 1)
  return (
    <>
      {bands.map((band, index) => (
        <instancedMesh
          key={`${band.name}-${count}`}
          ref={(mesh) => {
            bandRefs.current[index] = mesh
          }}
          args={[undefined, undefined, count]}
          frustumCulled={false}
        >
          {UNIT_SHAPES.box}
          <Matte color={band.color} />
        </instancedMesh>
      ))}
    </>
  )
}
