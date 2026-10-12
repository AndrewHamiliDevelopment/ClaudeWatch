import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import type { Group } from 'three'
import {
  createBatchRoot,
  createMeshBatches,
  freezeMatrices,
  releaseMeshBatches,
  thawMatrices,
  updateMeshBatches,
  type MeshBatch
} from './mesh-batches'

interface BatchUpdaterProps {
  root: Group
  revision: string
  isStatic: boolean
}

function BatchUpdater({ root, revision, isStatic }: BatchUpdaterProps) {
  const batches = useRef<MeshBatch[]>([])
  useLayoutEffect(() => {
    if (isStatic) thawMatrices(root)
    batches.current = createMeshBatches(root)
    if (isStatic) freezeMatrices(root)
    return () => {
      releaseMeshBatches(root, batches.current)
      batches.current = []
    }
  }, [root, revision, isStatic])
  // Mounted after the controllers so instance matrices see this frame's pose and wall height.
  // Nothing in a static batch moves: it was placed once, when the batches were built.
  useFrame(() => {
    if (!isStatic) updateMeshBatches(root, batches.current)
  })
  return null
}

interface BatchedSceneProps {
  children: ReactNode
  revision: string
  // For parts that never move between revisions (buildings, props): no work per frame.
  isStatic?: boolean
}

export function BatchedScene({ children, revision, isStatic = false }: BatchedSceneProps) {
  const root = useRef(createBatchRoot()).current
  return (
    <primitive object={root}>
      {children}
      <BatchUpdater root={root} revision={revision} isStatic={isStatic} />
    </primitive>
  )
}
