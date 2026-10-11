import { useFrame } from '@react-three/fiber'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Group } from 'three'
import {
  createMeshBatches,
  releaseMeshBatches,
  updateMeshBatches,
  type MeshBatch
} from './mesh-batches'

function BatchUpdater({ root, revision }: { root: Group; revision: string }) {
  const batches = useRef<MeshBatch[]>([])
  useLayoutEffect(() => {
    batches.current = createMeshBatches(root)
    return () => {
      releaseMeshBatches(root, batches.current)
      batches.current = []
    }
  }, [root, revision])
  // Mounted after the controllers so instance matrices see this frame's pose and wall height.
  useFrame(() => updateMeshBatches(root, batches.current))
  return null
}

export function BatchedScene({ children, revision }: { children: ReactNode; revision: string }) {
  const root = useRef(new Group()).current
  return (
    <primitive object={root}>
      {children}
      <BatchUpdater root={root} revision={revision} />
    </primitive>
  )
}
