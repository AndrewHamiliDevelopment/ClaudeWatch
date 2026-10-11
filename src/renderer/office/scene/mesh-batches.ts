import {
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  type Material,
  type Object3D
} from 'three'

interface SourceMesh {
  mesh: Mesh
  layerMask: number
  count: number
}
export interface MeshBatch {
  mesh: InstancedMesh
  sources: SourceMesh[]
}

function batchKey(mesh: Mesh, material: Material): string | null {
  if (material.transparent || !material.visible) return null
  const geometry = mesh.geometry.toJSON()
  const shading = material.toJSON()
  // Textured signs and per-agent transparent effects keep their own draw and ordering.
  if ('map' in shading || !('parameters' in mesh.geometry)) return null
  const { uuid: geometryId, metadata: geometryMetadata, ...shape } = geometry
  const { uuid: materialId, metadata: materialMetadata, ...surface } = shading
  void geometryId
  void geometryMetadata
  void materialId
  void materialMetadata
  return JSON.stringify([shape, surface])
}

export function createMeshBatches(root: Group): MeshBatch[] {
  const groups = new Map<string, SourceMesh[]>()
  root.traverse((object) => {
    if (!(object instanceof Mesh) || Array.isArray(object.material)) return
    const key = batchKey(object, object.material)
    if (!key) return
    const sources = groups.get(key) ?? []
    sources.push({
      mesh: object,
      layerMask: object.layers.mask,
      count: object instanceof InstancedMesh ? object.count : 1
    })
    groups.set(key, sources)
  })
  const batches: MeshBatch[] = []
  for (const sources of groups.values()) {
    if (sources.length < 2) continue
    const first = sources[0].mesh
    const mesh = new InstancedMesh(
      first.geometry,
      first.material,
      sources.reduce((sum, source) => sum + source.count, 0)
    )
    mesh.instanceMatrix.setUsage(DynamicDrawUsage)
    mesh.frustumCulled = false
    // Controller refs still mutate the originals; only their camera layer is disabled.
    for (const source of sources) source.mesh.layers.disable(0)
    root.add(mesh)
    batches.push({ mesh, sources })
  }
  updateMeshBatches(root, batches)
  return batches
}

const inverseRoot = new Matrix4()
const matrix = new Matrix4()
const instance = new Matrix4()
const hidden = new Matrix4().makeScale(0, 0, 0)

function isVisible(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent) {
    if (!current.visible) return false
  }
  return true
}

export function updateMeshBatches(root: Group, batches: readonly MeshBatch[]): void {
  root.updateWorldMatrix(true, true)
  inverseRoot.copy(root.matrixWorld).invert()
  for (const batch of batches) {
    let index = 0
    for (const source of batch.sources) {
      const visible = isVisible(source.mesh)
      for (let part = 0; part < source.count; part++) {
        matrix.multiplyMatrices(inverseRoot, source.mesh.matrixWorld)
        if (source.mesh instanceof InstancedMesh) {
          source.mesh.getMatrixAt(part, instance)
          matrix.multiply(instance)
        }
        batch.mesh.setMatrixAt(index++, visible ? matrix : hidden)
      }
    }
    batch.mesh.instanceMatrix.needsUpdate = true
  }
}

export function releaseMeshBatches(root: Group, batches: readonly MeshBatch[]): void {
  for (const batch of batches) {
    for (const source of batch.sources) source.mesh.layers.mask = source.layerMask
    root.remove(batch.mesh)
    batch.mesh.dispose()
  }
}
