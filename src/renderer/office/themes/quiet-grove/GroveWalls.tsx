import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import type { InstancedMesh } from 'three'
import {
  floorWallSegments,
  WALL_HEIGHT_FULL,
  WALL_HEIGHT_LOW,
  type WallSegment
} from '../../logic/room-layout'
import { createWallHeights } from '../../logic/wall-heights'
import { Matte } from '../../scene/InstancedParts'
import { writeInstances, type InstancePlacement } from '../../scene/instancing'
import type { WallsProps } from '../types'
import { UNIT_SHAPES } from '../unit-parts'
import { GROVE } from './palette'

const PLANTER = { height: 0.24, thickness: 0.3 }
const HEDGE_THICKNESS = 0.22
// A divider tops out below a wall of the other themes: the grove stays open to the eye.
const HEDGE_SHARE = 0.62
const SAPLING_SPACING = 1.7
const TRUNK_WIDTH = 0.07
const CANOPY = { full: 0.6, low: 0.26 }

const dividerHeight = (wallHeight: number): number => wallHeight * HEDGE_SHARE

interface Sapling {
  segment: number
  x: number
  z: number
}

// Evenly along each divider, never at its ends where two dividers meet.
function saplingsAlong(segments: readonly WallSegment[]): Sapling[] {
  return segments.flatMap((segment, index) => {
    const count = Math.floor(segment.length / SAPLING_SPACING)
    const isAlongX = segment.normalZ !== 0
    return Array.from({ length: count }, (_, step) => {
      const along = ((step + 0.5) / count - 0.5) * segment.length
      return {
        segment: index,
        x: segment.x + (isAlongX ? along : 0),
        z: segment.z + (isAlongX ? 0 : along)
      }
    })
  })
}

// Room dividers that grow instead of standing: a timber planter that never drops, a hedge that
// rises out of it to the wall height, and saplings above. Cutaway and walls-down lower the
// hedge into the planter and shrink the saplings to shrubs. Four instanced shapes for a floor.
export function GroveWalls({ rooms, mode, isReducedMotion }: WallsProps) {
  const planterRef = useRef<InstancedMesh>(null)
  const hedgeRef = useRef<InstancedMesh>(null)
  const trunkRef = useRef<InstancedMesh>(null)
  const canopyRef = useRef<InstancedMesh>(null)
  const segments = useMemo(() => floorWallSegments(rooms), [rooms])
  const saplings = useMemo(() => saplingsAlong(segments), [segments])
  const wallHeights = useRef(createWallHeights(WALL_HEIGHT_FULL)).current

  useFrame(({ camera }, delta) => {
    const [planter, hedge, trunk, canopy] = [planterRef, hedgeRef, trunkRef, canopyRef].map(
      (ref) => ref.current
    )
    if (!planter || !hedge || !trunk || !canopy) return
    // Settled dividers under a still camera need no new instance matrices.
    if (!wallHeights.step(segments, mode, camera.position, delta, isReducedMotion)) return
    const planters: InstancePlacement[] = []
    const hedges: InstancePlacement[] = []
    segments.forEach((segment, index) => {
      const along = {
        x: segment.x,
        z: segment.z,
        rotationY: segment.normalZ === 0 ? Math.PI / 2 : 0
      }
      const hedgeHeight = Math.max(dividerHeight(wallHeights.heights[index]) - PLANTER.height, 0.01)
      planters.push({
        ...along,
        y: PLANTER.height / 2,
        scaleX: segment.length + PLANTER.thickness,
        scaleY: PLANTER.height,
        scaleZ: PLANTER.thickness
      })
      hedges.push({
        ...along,
        y: PLANTER.height + hedgeHeight / 2,
        scaleX: segment.length,
        scaleY: hedgeHeight,
        scaleZ: HEDGE_THICKNESS
      })
    })
    const trunks: InstancePlacement[] = []
    const canopies: InstancePlacement[] = []
    for (const sapling of saplings) {
      const wall = wallHeights.heights[sapling.segment]
      const height = dividerHeight(wall)
      const grown = (wall - WALL_HEIGHT_LOW) / (WALL_HEIGHT_FULL - WALL_HEIGHT_LOW)
      const width = CANOPY.low + (CANOPY.full - CANOPY.low) * grown
      const top = height + width * 0.45
      trunks.push({
        x: sapling.x,
        y: (PLANTER.height + top) / 2,
        z: sapling.z,
        rotationY: 0,
        scaleX: TRUNK_WIDTH,
        scaleY: top - PLANTER.height,
        scaleZ: TRUNK_WIDTH
      })
      canopies.push({
        x: sapling.x,
        y: top,
        z: sapling.z,
        rotationY: 0,
        scaleX: width,
        scaleY: width * 0.85,
        scaleZ: width
      })
    }
    writeInstances(planter, planters)
    writeInstances(hedge, hedges)
    writeInstances(trunk, trunks)
    writeInstances(canopy, canopies)
  })

  const segmentCount = Math.max(segments.length, 1)
  const saplingCount = Math.max(saplings.length, 1)
  return (
    <>
      <instancedMesh
        key={`planter-${segmentCount}`}
        ref={planterRef}
        args={[undefined, undefined, segmentCount]}
        frustumCulled={false}
      >
        {UNIT_SHAPES.box}
        <Matte color={GROVE.bark} />
      </instancedMesh>
      <instancedMesh
        key={`hedge-${segmentCount}`}
        ref={hedgeRef}
        args={[undefined, undefined, segmentCount]}
        frustumCulled={false}
      >
        {UNIT_SHAPES.box}
        <Matte color={GROVE.pine} />
      </instancedMesh>
      <instancedMesh
        key={`trunk-${saplingCount}`}
        ref={trunkRef}
        args={[undefined, undefined, saplingCount]}
        frustumCulled={false}
      >
        {UNIT_SHAPES.cylinder}
        <Matte color={GROVE.bark} />
      </instancedMesh>
      <instancedMesh
        key={`canopy-${saplingCount}`}
        ref={canopyRef}
        args={[undefined, undefined, saplingCount]}
        frustumCulled={false}
      >
        {UNIT_SHAPES.sphere}
        <Matte color={GROVE.fern} />
      </instancedMesh>
    </>
  )
}
