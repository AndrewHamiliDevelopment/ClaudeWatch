import { isValidElement, type ReactElement, type ReactNode } from 'react'
import {
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type BufferGeometry,
  type Material
} from 'three'
import { InstancedParts } from '../../scene/InstancedParts'
import { createMeshBatches, releaseMeshBatches } from '../../scene/mesh-batches'
import { makeGeometry } from '../geometry-audit.test-utils'

interface NodeProps {
  children?: ReactNode
  args?: readonly (number | BufferGeometry | Material | undefined)[]
  placements?: readonly object[]
  name?: string
  visible?: boolean
  transparent?: boolean
  userData?: Record<string, string>
}
export type SceneElement = ReactElement<NodeProps>

// Expands the real procedural JSX without a Canvas; the caller mocks the React hooks.
function expand(node: ReactNode): ReactNode {
  if (
    !isValidElement<NodeProps>(node) ||
    typeof node.type !== 'function' ||
    node.type === InstancedParts
  )
    return node
  return expand((node.type as (props: NodeProps) => ReactNode)(node.props))
}

function directChildren(node: ReactNode): SceneElement[] {
  if (Array.isArray(node)) return node.flatMap(directChildren)
  const element = expand(node)
  if (Array.isArray(element)) return element.flatMap(directChildren)
  return isValidElement<NodeProps>(element) ? [element] : []
}

export function everyElement(node: ReactNode): SceneElement[] {
  return directChildren(node).flatMap((child) => [child, ...everyElement(child.props.children)])
}

function surfaceOf(material: SceneElement): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(material.props).filter(([key]) => key !== 'ref' && key !== 'children')
  )
}

// dry-new: the expansion live-budget.test.tsx runs; a test file cannot export its harness.
function sceneGraph(node: ReactNode): Group {
  const root = new Group()
  for (const child of directChildren(node)) {
    const isInstanced = child.type === InstancedParts || child.type === 'instancedMesh'
    if (child.type !== 'mesh' && !isInstanced) {
      root.add(sceneGraph(child.props.children))
      continue
    }
    let geometry: BufferGeometry | undefined
    let material: Material | undefined
    for (const part of directChildren(child.props.children)) {
      if (typeof part.type !== 'string') continue
      if (part.type.endsWith('Geometry'))
        geometry = makeGeometry(
          part.type,
          (part.props.args ?? []).map((value) => (typeof value === 'number' ? value : undefined))
        )
      if (part.type === 'meshBasicMaterial') material = new MeshBasicMaterial(surfaceOf(part))
      if (part.type === 'meshStandardMaterial') material = new MeshStandardMaterial(surfaceOf(part))
    }
    if (!geometry || !material) throw new Error('Missing geometry or material')
    const count =
      child.props.placements?.length ??
      (typeof child.props.args?.[2] === 'number' ? child.props.args[2] : 1)
    const mesh = isInstanced
      ? new InstancedMesh(geometry, material, count)
      : new Mesh(geometry, material)
    Object.assign(mesh.userData, child.props.userData)
    root.add(mesh)
  }
  return root
}

// Merged as BatchedScene merges at runtime: an upper bound with every effect switched on.
// Textured signs never merge and belong to no theme, so they are counted apart.
export function mergedDraws(node: ReactNode): { all: number; untextured: number } {
  const root = sceneGraph(node)
  const batches = createMeshBatches(root)
  const drawn: Material[] = []
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !object.layers.isEnabled(0)) return
    if (!Array.isArray(object.material) && object.material.visible) drawn.push(object.material)
  })
  releaseMeshBatches(root, batches)
  return {
    all: drawn.length,
    untextured: drawn.filter((material) => !('map' in material && material.map)).length
  }
}
