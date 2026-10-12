import { createElement, isValidElement, type ReactElement, type ReactNode } from 'react'
import {
  BufferGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  type Material
} from 'three'
import { InstancedParts } from '../scene/InstancedParts'
import { createMeshBatches, releaseMeshBatches } from '../scene/mesh-batches'
import { makeGeometry } from './geometry-audit.test-utils'
import { GROUND_Y } from './surroundings'
import type { AmbientProps, OfficeTheme, SurroundingsProps } from './types'

interface NodeProps {
  children?: ReactNode
  args?: readonly (number | BufferGeometry | Material | undefined)[]
  placements?: readonly object[]
  geometry?: BufferGeometry
  name?: string
  visible?: boolean
  transparent?: boolean
  userData?: Record<string, string>
  // Test-only: marks a subtree whose materials must not merge with any other theme's.
  unshared?: boolean
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

function sceneGraph(node: ReactNode, isUnshared = false): Group {
  const root = new Group()
  for (const child of directChildren(node)) {
    const isInstanced = child.type === InstancedParts || child.type === 'instancedMesh'
    if (child.type !== 'mesh' && !isInstanced) {
      root.add(sceneGraph(child.props.children, isUnshared || child.props.unshared === true))
      continue
    }
    let geometry =
      child.props.geometry ??
      (child.props.args?.[0] instanceof BufferGeometry ? child.props.args[0] : undefined)
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
    if (!geometry || !material)
      throw new Error(`Missing geometry or material for ${String(child.type)}`)
    if (isUnshared) material.name = 'unshared'
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

export interface DrawCount {
  draws: number
  // Textured signs never merge and belong to no theme, so a theme's own cost leaves them out.
  untextured: number
  triangles: number
}

// Merged as one BatchedScene merges at runtime. An upper bound: every effect is switched on,
// because only a hidden material, not a hidden object, is left out.
export function mergedDraws(node: ReactNode): DrawCount {
  const root = sceneGraph(node)
  const batches = createMeshBatches(root)
  const counted: DrawCount = { draws: 0, untextured: 0, triangles: 0 }
  root.traverse((object) => {
    if (!(object instanceof Mesh) || !object.layers.isEnabled(0)) return
    if (Array.isArray(object.material) || !object.material.visible) return
    counted.draws += 1
    if (!('map' in object.material && object.material.map)) counted.untextured += 1
    counted.triangles +=
      ((object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3) *
      (object instanceof InstancedMesh ? object.count : 1)
  })
  releaseMeshBatches(root, batches)
  return counted
}

type Triple = [number, number, number]

function boxPart(key: string, at: Triple, size: Triple, color: string) {
  return createElement(
    'mesh',
    { key, position: at, scale: size },
    createElement('boxGeometry', { args: [1, 1, 1] }),
    createElement('meshStandardMaterial', { color })
  )
}

// A stand-in for a theme's surroundings, so the wiring and the draw budget are proven before the
// real ones exist: a body and a roof per building, a crate per prop and one mover.
export function withBoxSurroundings(theme: OfficeTheme, id: string): OfficeTheme {
  const { palette } = theme
  const Surroundings = ({ lots }: SurroundingsProps) =>
    createElement(
      'group',
      null,
      lots.flatMap((lot) => {
        const height = lot.maxHeight - GROUND_Y
        const body: Triple = [lot.width, height, lot.depth]
        const centre: Triple = [lot.x, GROUND_Y + height / 2, lot.z]
        if (lot.kind === 'prop') return [boxPart(lot.id, centre, body, palette.brass)]
        return [
          boxPart(lot.id, centre, body, palette.wood),
          boxPart(
            `${lot.id}:roof`,
            [lot.x, lot.maxHeight, lot.z],
            [lot.width, 0.2, lot.depth],
            palette.ink
          )
        ]
      })
    )
  const Ambient = ({ lots }: AmbientProps) =>
    createElement(
      'mesh',
      { position: [lots[0]?.x ?? 0, 3, lots[0]?.z ?? 0] },
      createElement('sphereGeometry', { args: [0.4, 8, 6] }),
      createElement('meshStandardMaterial', { color: palette.glow })
    )
  return { ...theme, id, kit: { ...theme.kit, zone: { ...theme.kit.zone, Surroundings, Ambient } } }
}
