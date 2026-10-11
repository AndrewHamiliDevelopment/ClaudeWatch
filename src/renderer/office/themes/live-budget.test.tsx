import { createElement, isValidElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import {
  BufferGeometry,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Texture,
  type Material,
  type MeshBasicMaterialParameters,
  type MeshStandardMaterialParameters
} from 'three'
import { FloorView } from '../scene/FloorView'
import { Robot } from '../scene/Robot'
import { WorldView } from '../scene/WorldView'
import { InstancedParts } from '../scene/InstancedParts'
import { createMeshBatches, releaseMeshBatches } from '../scene/mesh-batches'
import { makeGeometry } from './geometry-audit.test-utils'
import { listThemes } from './registry'
import { makeSession } from '../__tests__/fixtures'
import { layoutFloor, agentsForFloor } from '../fixture/fixture-layout'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useLayoutEffect: () => undefined,
  useRef: (current: object) => ({ current })
}))
vi.mock('@react-three/fiber', () => ({ useFrame: () => undefined }))
vi.mock('../scene/textures', () => ({
  signTexture: () => new Texture(),
  blobShadowTexture: () => new Texture()
}))

interface NodeProps {
  children?: ReactNode
  args?: readonly (number | BufferGeometry | Material | undefined)[]
  placements?: readonly object[]
  geometry?: BufferGeometry
}

function expand(node: ReactNode): ReactNode {
  if (
    !isValidElement<NodeProps>(node) ||
    typeof node.type !== 'function' ||
    node.type === InstancedParts
  )
    return node
  return expand((node.type as (props: NodeProps) => ReactNode)(node.props))
}

function directChildren(node: ReactNode): ReactNode[] {
  if (Array.isArray(node)) return node.flatMap(directChildren)
  const element = expand(node)
  if (Array.isArray(element)) return element.flatMap(directChildren)
  if (!isValidElement<NodeProps>(element)) return []
  return [element]
}

function materialProps(props: NodeProps): object {
  return Object.fromEntries(Object.entries(props).filter(([key]) => key !== 'ref'))
}

function sceneGraph(node: ReactNode): Group {
  const root = new Group()
  for (const child of directChildren(node)) {
    if (!isValidElement<NodeProps>(child)) continue
    const kind = child.type
    const instanced = kind === InstancedParts || kind === 'instancedMesh'
    if (kind === 'mesh' || instanced) {
      let geometry =
        child.props.geometry ??
        (child.props.args?.[0] instanceof BufferGeometry ? child.props.args[0] : undefined)
      let material: Material | undefined
      for (const part of directChildren(child.props.children)) {
        if (!isValidElement<NodeProps>(part) || typeof part.type !== 'string') continue
        if (part.type.endsWith('Geometry'))
          geometry = makeGeometry(
            part.type,
            (part.props.args ?? []).map((value) => (typeof value === 'number' ? value : undefined))
          )
        if (part.type === 'meshBasicMaterial')
          material = new MeshBasicMaterial(materialProps(part.props) as MeshBasicMaterialParameters)
        if (part.type === 'meshStandardMaterial')
          material = new MeshStandardMaterial(
            materialProps(part.props) as MeshStandardMaterialParameters
          )
      }
      if (!geometry || !material) throw new Error(`Missing geometry/material for ${String(kind)}`)
      const mesh = instanced
        ? new InstancedMesh(
            geometry,
            material,
            child.props.placements?.length ??
              (typeof child.props.args?.[2] === 'number' ? child.props.args[2] : 1)
          )
        : new Mesh(geometry, material)
      root.add(mesh)
    } else {
      root.add(sceneGraph(child.props.children))
    }
  }
  return root
}

for (const theme of listThemes())
  it(`${theme.id} live composition with 20 agents stays below 300 draws and 600k triangles`, () => {
    const sessions = Array.from({ length: 20 }, (_, i) =>
      makeSession({ key: `claude:${i}`, provider: i % 2 ? 'codex' : 'claude' })
    )
    const floor = layoutFloor({ floorId: 'budget', label: 'Budget', plate: 1, sessions })
    const agents = agentsForFloor(floor, sessions)
    expect(agents).toHaveLength(20)
    const focused = sceneGraph([
      createElement(FloorView, { floor, theme, wallsMode: 'cutaway', isReducedMotion: true }),
      ...agents.map((agent) =>
        createElement(Robot, {
          theme,
          agent,
          isSelected: true,
          isSpeaking: true,
          isReducedMotion: true,
          onSelect: () => undefined,
          onFly: () => undefined
        })
      )
    ])
    const world = sceneGraph(
      createElement(WorldView, {
        floor,
        theme,
        band: 'building',
        floors: [{ floorId: floor.floorId, label: floor.label, agentCount: 20, attentionCount: 2 }]
      })
    )
    // This upper bound includes every speech puff, thought dot and steam puff at once.
    const batches = createMeshBatches(focused)
    let draws = 0
    let triangles = 0
    for (const root of [focused, world])
      root.traverse((object) => {
        if (
          !(object instanceof Mesh) ||
          !object.layers.isEnabled(0) ||
          Array.isArray(object.material) ||
          !object.material.visible
        )
          return
        draws++
        triangles +=
          ((object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3) *
          (object instanceof InstancedMesh ? object.count : 1)
      })
    console.info(`${theme.id} live, 20 agents: ${draws} draw calls, ${triangles} triangles`)
    expect(draws).toBeLessThanOrEqual(300)
    expect(triangles).toBeLessThanOrEqual(600_000)
    releaseMeshBatches(focused, batches)
  })
