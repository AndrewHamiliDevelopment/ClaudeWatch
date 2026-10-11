import { Object3D, type InstancedMesh } from 'three'

export interface InstancePlacement {
  x: number
  y: number
  z: number
  rotationY: number
  scaleX?: number
  scaleY?: number
  scaleZ?: number
}

const scratch = new Object3D()

// One draw call per furniture kind per floor instead of one per object.
export function writeInstances(
  mesh: InstancedMesh,
  placements: readonly InstancePlacement[]
): void {
  placements.forEach((placement, index) => {
    scratch.position.set(placement.x, placement.y, placement.z)
    scratch.rotation.set(0, placement.rotationY, 0)
    scratch.scale.set(placement.scaleX ?? 1, placement.scaleY ?? 1, placement.scaleZ ?? 1)
    scratch.updateMatrix()
    mesh.setMatrixAt(index, scratch.matrix)
  })
  mesh.count = placements.length
  mesh.instanceMatrix.needsUpdate = true
}
