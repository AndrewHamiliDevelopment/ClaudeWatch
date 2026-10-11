import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { InstancedMesh } from 'three'
import { floorWallSegments, WALL_HEIGHT_FULL } from '../../logic/room-layout'
import { createWallHeights } from '../../logic/wall-heights'
import { Matte } from '../../scene/InstancedParts'
import { writeInstances, type InstancePlacement } from '../../scene/instancing'
import type { WallsProps } from '../types'
import { UNIT_SHAPES } from '../unit-parts'
import { COURT } from './palette'

const LAYERS = [
  { name: 'panel', color: COURT.violet, thickness: 0.14 },
  { name: 'glass', color: COURT.ink, thickness: 0.17 },
  { name: 'rail', color: COURT.gold, thickness: 0.2 }
] as const
const GLASS = { centre: 0.58, share: 0.3 }
const RAIL_HEIGHT = 0.06

// dry-new: the Edo and Brass walls bake their colours and sizes in; these are unit boxes so the
// violet panels, dark glass band and gold rail merge with the rest of the theme.
export function CourtWalls({ rooms, mode, isReducedMotion }: WallsProps) {
  const panelRef = useRef<InstancedMesh>(null)
  const glassRef = useRef<InstancedMesh>(null)
  const railRef = useRef<InstancedMesh>(null)
  const layerRefs = [panelRef, glassRef, railRef]
  const segments = useMemo(() => floorWallSegments(rooms), [rooms])
  const wallHeights = useRef(createWallHeights(WALL_HEIGHT_FULL)).current

  useFrame(({ camera }, delta) => {
    if (!panelRef.current || !glassRef.current || !railRef.current) return
    // Settled walls under a still camera need no new instance matrices.
    if (!wallHeights.step(segments, mode, camera.position, delta, isReducedMotion)) return
    const placements: InstancePlacement[][] = [[], [], []]
    segments.forEach((segment, index) => {
      const height = wallHeights.heights[index]
      const along = {
        x: segment.x,
        z: segment.z,
        rotationY: segment.normalZ === 0 ? Math.PI / 2 : 0
      }
      const bands = [
        { y: height / 2, scaleY: height },
        { y: height * GLASS.centre, scaleY: height * GLASS.share },
        { y: height, scaleY: RAIL_HEIGHT }
      ]
      bands.forEach((band, layer) =>
        placements[layer].push({
          ...along,
          ...band,
          scaleX: segment.length + LAYERS[layer].thickness,
          scaleZ: LAYERS[layer].thickness
        })
      )
    })
    writeInstances(panelRef.current, placements[0])
    writeInstances(glassRef.current, placements[1])
    writeInstances(railRef.current, placements[2])
  })

  const count = Math.max(segments.length, 1)
  return (
    <>
      {LAYERS.map((layer, index) => (
        <instancedMesh
          key={`${layer.name}-${count}`}
          ref={layerRefs[index]}
          args={[undefined, undefined, count]}
          frustumCulled={false}
        >
          {UNIT_SHAPES.box}
          <Matte color={layer.color} />
        </instancedMesh>
      ))}
    </>
  )
}
