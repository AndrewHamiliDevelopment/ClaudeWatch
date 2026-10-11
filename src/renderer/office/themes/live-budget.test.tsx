import { createElement, isValidElement, type ComponentType, type ReactNode } from 'react'
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
import { RobotCrew } from '../scene/Robot'
import { WorldView } from '../scene/WorldView'
import { InstancedParts } from '../scene/InstancedParts'
import { createMeshBatches, releaseMeshBatches } from '../scene/mesh-batches'
import { makeGeometry } from './geometry-audit.test-utils'
import { getTheme, listThemes, registerTheme } from './registry'
import type { OfficeTheme } from './types'
import { makeSession } from '../__tests__/fixtures'
import { agentsForFloor, layoutFloor } from '../fixture/fixture-layout'
import { buildFixtureFrame } from '../fixture/fixture-feed'
import { groupZonesByTheme, type ThemedZone } from '../logic/office-themes'
import type { AgentView } from '../../../shared/office/types'
import type { FloorGeometry } from '../scene-model'

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
  userData?: Record<string, string>
  // Test-only: marks a subtree whose materials must not merge with any other theme's.
  unshared?: boolean
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

function sceneGraph(node: ReactNode, isUnshared = false): Group {
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
      if (isUnshared) material.name = 'unshared'
      const mesh = instanced
        ? new InstancedMesh(
            geometry,
            material,
            child.props.placements?.length ??
              (typeof child.props.args?.[2] === 'number' ? child.props.args[2] : 1)
          )
        : new Mesh(geometry, material)
      Object.assign(mesh.userData, child.props.userData)
      root.add(mesh)
    } else {
      root.add(sceneGraph(child.props.children, isUnshared || child.props.unshared === true))
    }
  }
  return root
}

const DRAW_CEILING = 300
const TRIANGLE_CEILING = 600_000
const EDO = 'neo-edo-steam'
const BRASS = 'brass-workshop'

interface Composition {
  floor: FloorGeometry
  agents: readonly AgentView[]
  floorTheme: OfficeTheme
  themeIdFor: (zone: ThemedZone) => string
}

function countDraws(root: Group): { draws: number; triangles: number } {
  let draws = 0
  let triangles = 0
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
  return { draws, triangles }
}

// An upper bound: every thought dot and steam puff at once, and the world at building zoom.
function measure({ floor, agents, floorTheme, themeIdFor }: Composition) {
  const zoneGroups = groupZonesByTheme(floor, themeIdFor)
  const focused = sceneGraph([
    createElement(FloorView, {
      floor,
      floorTheme,
      zoneGroups,
      wallsMode: 'cutaway',
      isReducedMotion: true
    }),
    createElement(RobotCrew, {
      agents,
      zoneGroups,
      floorTheme,
      selectedAgentKey: agents[0]?.agentKey ?? null,
      speakingAgentKey: agents[0]?.agentKey ?? null,
      isReducedMotion: true,
      onSelect: () => undefined,
      onFly: () => undefined
    })
  ])
  const world = sceneGraph(
    createElement(WorldView, {
      floor,
      theme: floorTheme,
      band: 'building',
      floors: [
        { floorId: floor.floorId, label: floor.label, agentCount: agents.length, attentionCount: 2 }
      ]
    })
  )
  // Each layer merges on its own, as its own BatchedScene does at runtime.
  const layers = [focused, world].map((root) => {
    const batches = createMeshBatches(root)
    const counted = countDraws(root)
    releaseMeshBatches(root, batches)
    return counted
  })
  return {
    themeCount: zoneGroups.length,
    worldDraws: layers[1].draws,
    draws: layers[0].draws + layers[1].draws,
    triangles: layers[0].triangles + layers[1].triangles
  }
}

function twentyAgents(companyCount: number): Pick<Composition, 'floor' | 'agents'> {
  const sessions = Array.from({ length: 20 }, (_, i) =>
    makeSession({
      key: `claude:${i}`,
      provider: i % 2 ? 'codex' : 'claude',
      companyKey: `c_${i % companyCount}`,
      companyLabel: `Company ${i % companyCount}`,
      projectKey: `p_${i % companyCount}`,
      projectLabel: `Project ${i % companyCount}`
    })
  )
  const floor = layoutFloor({ floorId: 'budget', label: 'Budget', plate: 1, sessions })
  const agents = agentsForFloor(floor, sessions)
  expect(agents).toHaveLength(20)
  return { floor, agents }
}

function report(name: string, result: ReturnType<typeof measure>): void {
  console.info(
    `${name}: ${result.draws} draw calls (${result.worldDraws} world), ${result.triangles} triangles`
  )
}

for (const theme of listThemes())
  it(`${theme.id} live composition with 20 agents stays below 300 draws and 600k triangles`, () => {
    const result = measure({ ...twentyAgents(1), floorTheme: theme, themeIdFor: () => theme.id })
    report(`${theme.id} live, 20 agents`, result)
    expect(result.draws).toBeLessThanOrEqual(DRAW_CEILING)
    expect(result.triangles).toBeLessThanOrEqual(TRIANGLE_CEILING)
  })

// A stand-in for a theme that shares no part with another: Brass's cost, merged only with itself.
function unshared<Props extends object>(Component: ComponentType<Props>): ComponentType<Props> {
  return (props: Props) =>
    createElement('group', { unshared: true }, createElement(Component, props))
}
const brass = getTheme(BRASS)
const UNSHARED = 'test-unshared'
registerTheme({
  ...brass,
  id: UNSHARED,
  robot: { ...brass.robot, Model: unshared(brass.robot.Model) },
  kit: {
    ...brass.kit,
    zone: {
      CompanyZone: unshared(brass.kit.zone.CompanyZone),
      ProjectOffice: unshared(brass.kit.zone.ProjectOffice),
      RoomFloors: unshared(brass.kit.zone.RoomFloors),
      Walls: unshared(brass.kit.zone.Walls),
      Doorway: unshared(brass.kit.zone.Doorway),
      Desk: unshared(brass.kit.zone.Desk),
      RoomDressing: unshared(brass.kit.zone.RoomDressing),
      RoomSign: unshared(brass.kit.zone.RoomSign)
    }
  }
})

const companyThemes =
  (themeIds: readonly string[]) =>
  (zone: ThemedZone): string =>
    themeIds[Number(zone.companyKey?.slice(2) ?? 0) % themeIds.length]

it('four companies alternating the two built-in themes stay inside the draw ceiling', () => {
  const result = measure({
    ...twentyAgents(4),
    floorTheme: getTheme(EDO),
    themeIdFor: companyThemes([EDO, BRASS])
  })
  report('edo + brass, 4 companies, 20 agents', result)
  expect(result.themeCount).toBe(2)
  expect(result.draws).toBeLessThanOrEqual(DRAW_CEILING)
  expect(result.triangles).toBeLessThanOrEqual(TRIANGLE_CEILING)
})

it('four companies alternating Neo Edo Steam and Violet Court stay inside the draw ceiling', () => {
  const result = measure({
    ...twentyAgents(4),
    floorTheme: getTheme(EDO),
    themeIdFor: companyThemes([EDO, 'violet-court'])
  })
  report('edo + violet court, 4 companies, 20 agents', result)
  expect(result.themeCount).toBe(2)
  expect(result.draws).toBeLessThanOrEqual(DRAW_CEILING)
  expect(result.triangles).toBeLessThanOrEqual(TRIANGLE_CEILING)
})

it.each([
  ['Neo Edo Steam and Orbital Garrison', [EDO, 'orbital-garrison']],
  ['Neo Edo Steam, Violet Court and Orbital Garrison', [EDO, 'violet-court', 'orbital-garrison']]
])('four companies on %s stay inside the draw ceiling', (name, themeIds) => {
  // An unregistered id would be measured as Neo Edo Steam.
  for (const themeId of themeIds) expect(getTheme(themeId).id).toBe(themeId)
  const result = measure({
    ...twentyAgents(4),
    floorTheme: getTheme(EDO),
    themeIdFor: companyThemes(themeIds)
  })
  report(`${name}, 4 companies, 20 agents`, result)
  expect(result.themeCount).toBe(themeIds.length)
  expect(result.draws).toBeLessThanOrEqual(DRAW_CEILING)
  expect(result.triangles).toBeLessThanOrEqual(TRIANGLE_CEILING)
})

it('a third theme that shares nothing still fits four companies inside the draw ceiling', () => {
  const result = measure({
    ...twentyAgents(4),
    floorTheme: getTheme(EDO),
    themeIdFor: companyThemes([EDO, BRASS, UNSHARED])
  })
  report('edo + brass + unshared, 4 companies, 20 agents', result)
  expect(result.themeCount).toBe(3)
  expect(result.draws).toBeLessThanOrEqual(DRAW_CEILING)
})

it('reports the preview fixture floor with one, two and three themes', () => {
  const { floors, agents } = buildFixtureFrame(0, 0)
  const companyKeys = floors[0].zones.map((zone) => zone.companyKey)
  const projectKeys = floors[0].zones.flatMap((zone) => zone.children.map((p) => p.projectKey))
  const compositions: [string, (zone: ThemedZone) => string][] = [
    ['fixture, 1 theme', () => EDO],
    ['fixture, 2 themes', (zone) => (zone.companyKey === companyKeys[0] ? BRASS : EDO)],
    [
      'fixture, 3 themes',
      (zone) =>
        zone.projectKey === projectKeys.at(-1)
          ? UNSHARED
          : zone.companyKey === companyKeys[0]
            ? BRASS
            : EDO
    ]
  ]
  compositions.forEach(([name, themeIdFor], index) => {
    const result = measure({ floor: floors[0], agents, floorTheme: getTheme(EDO), themeIdFor })
    report(`${name}, ${agents.length} agents`, result)
    expect(result.themeCount).toBe(index + 1)
    expect(result.draws).toBeLessThanOrEqual(DRAW_CEILING)
  })
})
