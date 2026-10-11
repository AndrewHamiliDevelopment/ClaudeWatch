import { isValidElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { signTexture } from './textures'
import { Lantern } from '../themes/primitives'
import { Robot, RobotCrew } from './Robot'
import { FloorView } from './FloorView'
import { WorldView } from './WorldView'
import { BatchedScene } from './BatchedScene'
import { groupZonesByTheme } from '../logic/office-themes'
import { ParkedFrames } from '../themes/ParkedFrames'
import { ThemeTower } from '../themes/WorldArchitecture'
import { getTheme, themeForTeam } from '../themes/registry'
import { BAND_ZOOM } from '../logic/camera-bands'
import { makeAgent, makeFloor, makeRoom, makeZone } from '../__tests__/fixtures'
import type { RobotModelProps } from '../themes/types'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory(),
  useLayoutEffect: () => undefined,
  useRef: () => ({ current: null })
}))
vi.mock('@react-three/fiber', () => ({ useFrame: () => undefined }))
vi.mock('./textures', () => ({ blobShadowTexture: () => null, signTexture: vi.fn() }))

function elements(node: ReactNode): React.ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Record<string, unknown>>(node)) return []
  return [node, ...elements(node.props.children as ReactNode)]
}

it('delegates the live Robot model to the theme with provider skin and articulation refs', () => {
  const Model = vi.fn((_props: RobotModelProps) => null)
  const theme = { ...themeForTeam(), robot: { ...themeForTeam().robot, Model } }
  const agent = makeAgent({ agentKey: 'a', provider: 'codex' })
  const nodes = elements(
    Robot({
      agent,
      theme,
      rosterIndex: 2,
      isSelected: true,
      isSpeaking: true,
      isReducedMotion: true,
      onSelect: vi.fn(),
      onFly: vi.fn()
    })
  )
  const model = nodes.find((node) => node.type === Model)
  expect(model).toBeDefined()
  if (!model) throw new Error('Missing model')
  if (isValidElement<RobotModelProps>(model)) Model(model.props)
  expect(Model).toHaveBeenCalledWith(
    expect.objectContaining({
      agent,
      skin: theme.robot.skins.codex,
      rosterIndex: 2,
      isReducedMotion: true,
      rig: expect.objectContaining({ head: { current: null }, base: { current: null } })
    })
  )
  expect(nodes.some((node) => node.type === 'capsuleGeometry')).toBe(true)
  expect(nodes.some((node) => node.type === 'ringGeometry')).toBe(true)
})

it('renders every floor surface through the theme kit', () => {
  const theme = themeForTeam()
  const floor = makeFloor({
    floorId: 'p1',
    rooms: [makeRoom({ id: 'r1' })],
    zones: [
      makeZone({
        id: 'c',
        kind: 'company',
        children: [makeZone({ id: 'p', kind: 'project', projectKey: 'p_1' })]
      })
    ]
  })
  const nodes = elements(
    FloorView({
      floor,
      floorTheme: theme,
      zoneGroups: groupZonesByTheme(floor, () => theme.id),
      wallsMode: 'cutaway',
      isReducedMotion: true
    })
  )
  for (const Component of [...Object.values(theme.kit.floor), ...Object.values(theme.kit.zone)]) {
    expect(nodes.some((node) => node.type === Component)).toBe(true)
  }
})

function companyZone(companyKey: string, projectKey: string, roomId: string) {
  return makeZone({
    id: companyKey,
    kind: 'company',
    companyKey,
    children: [
      makeZone({
        id: projectKey,
        kind: 'project',
        companyKey,
        projectKey,
        children: [makeZone({ id: roomId, kind: 'office', companyKey, projectKey })]
      })
    ]
  })
}

const edo = getTheme('neo-edo-steam')
const brass = getTheme('brass-workshop')
const mixedFloor = makeFloor({
  floorId: 'hq',
  rooms: [makeRoom({ id: 'room_a', bay: 1 }), makeRoom({ id: 'room_b', bay: 3 })],
  zones: [companyZone('c_a', 'p_a', 'room_a'), companyZone('c_b', 'p_b', 'room_b')]
})
const mixedGroups = groupZonesByTheme(mixedFloor, (zone) =>
  zone.companyKey === 'c_b' ? brass.id : edo.id
)

it('draws each zone with its own theme, and the slab and lift once with the floor theme', () => {
  const nodes = elements(
    FloorView({
      floor: mixedFloor,
      floorTheme: edo,
      zoneGroups: mixedGroups,
      wallsMode: 'cutaway',
      isReducedMotion: true
    })
  )
  const drawnBy = (component: unknown) => nodes.filter((node) => node.type === component)
  const zoneIds = (component: unknown) =>
    drawnBy(component).map((node) => (node.props.zone as { id: string }).id)
  const roomIds = (component: unknown) =>
    drawnBy(component).flatMap((node) =>
      (node.props.rooms as { id: string }[]).map((room) => room.id)
    )
  expect(zoneIds(edo.kit.zone.CompanyZone)).toEqual(['c_a'])
  expect(zoneIds(brass.kit.zone.CompanyZone)).toEqual(['c_b'])
  expect(zoneIds(edo.kit.zone.ProjectOffice)).toEqual(['p_a'])
  expect(zoneIds(brass.kit.zone.ProjectOffice)).toEqual(['p_b'])
  for (const part of ['Walls', 'RoomFloors'] as const) {
    expect(roomIds(edo.kit.zone[part])).toEqual(['room_a'])
    expect(roomIds(brass.kit.zone[part])).toEqual(['room_b'])
  }
  for (const part of ['Doorway', 'Desk', 'RoomDressing', 'RoomSign'] as const) {
    expect(drawnBy(edo.kit.zone[part]).map((node) => node.props.room)).toEqual([
      mixedFloor.rooms[0]
    ])
    expect(drawnBy(brass.kit.zone[part]).map((node) => node.props.room)).toEqual([
      mixedFloor.rooms[1]
    ])
  }
  for (const part of ['Slab', 'Elevator'] as const) {
    expect(drawnBy(edo.kit.floor[part])).toHaveLength(1)
    expect(drawnBy(brass.kit.floor[part])).toHaveLength(0)
  }
})

it('gives each robot the theme and roster place of its own room', () => {
  const agents = [
    makeAgent({ agentKey: 'a', roomId: 'room_a' }),
    makeAgent({ agentKey: 'b', roomId: 'room_b' }),
    makeAgent({ agentKey: 'c', roomId: 'not-on-this-floor' })
  ]
  const robots = elements(
    RobotCrew({
      agents,
      zoneGroups: mixedGroups,
      floorTheme: edo,
      selectedAgentKey: 'b',
      speakingAgentKey: null,
      isReducedMotion: true,
      onSelect: vi.fn(),
      onFly: vi.fn()
    })
  ).filter((node) => node.type === Robot)
  expect(
    robots.map((robot) => [
      (robot.props.agent as { agentKey: string }).agentKey,
      (robot.props.theme as { id: string }).id,
      robot.props.rosterIndex,
      robot.props.isSelected
    ])
  ).toEqual([
    ['a', edo.id, 1, false],
    ['b', brass.id, 3, true],
    ['c', edo.id, 0, false]
  ])
})

it('merges the world layer and rebuilds the merge when the theme or the tower changes', () => {
  const floor = makeFloor({ floorId: 'p1' })
  const world = (theme: typeof edo, band: 'floor' | 'building') =>
    WorldView({ floor, theme, floors: [], band })
  expect(world(edo, 'floor').type).toBe(BatchedScene)
  const revision = (theme: typeof edo, band: 'floor' | 'building') =>
    (world(theme, band).props as { revision: string }).revision
  expect(revision(edo, 'floor')).toBe(revision(edo, 'floor'))
  expect(revision(edo, 'floor')).not.toBe(revision(edo, 'building'))
  expect(revision(edo, 'floor')).not.toBe(revision(brass, 'floor'))
})

it('renders District and Hangar at floor zoom, and adds Tower only at building zoom', () => {
  const theme = themeForTeam()
  const props = { floor: makeFloor({ floorId: 'p1' }), theme, floors: [] }
  const floorNodes = elements(WorldView({ ...props, band: 'floor' }))
  expect(floorNodes.some((node) => node.type === theme.world.District)).toBe(true)
  expect(floorNodes.some((node) => node.type === theme.world.Hangar)).toBe(true)
  expect(floorNodes.some((node) => node.type === theme.world.Tower)).toBe(false)
  const buildingNodes = elements(WorldView({ ...props, band: 'building' }))
  const tower = buildingNodes.find((node) => node.type === theme.world.Tower)
  // One floor now: the Tower is a landmark and never switches floors.
  expect(tower).toBeDefined()
  expect(tower?.props.onFocusFloor).toBeUndefined()
})

it('clicking a labelled tower storey focuses that project without selecting an agent', () => {
  const focus = vi.fn()
  const stopPropagation = vi.fn()
  const nodes = elements(
    ThemeTower({
      floors: [{ floorId: 'p1', label: 'Office', agentCount: 20, attentionCount: 2 }],
      palette: themeForTeam().palette,
      onFocusFloor: focus
    })
  )
  const storey = nodes.find((node) => typeof node.props.onClick === 'function')
  expect(storey).toBeDefined()
  const click = storey?.props.onClick as (event: { stopPropagation: () => void }) => void
  click({ stopPropagation })
  expect(focus).toHaveBeenCalledWith('p1')
  expect(stopPropagation).toHaveBeenCalledOnce()
})

it('extends building zoom while preserving floor and desk bands', () => {
  expect(BAND_ZOOM.building).toBeLessThan(16)
  expect(BAND_ZOOM.floor).toBe(34)
  expect(BAND_ZOOM.desk).toBe(90)
})

it('populates the hangar with two decorative parked bodies and heads', () => {
  const nodes = elements(ParkedFrames({ palette: themeForTeam().palette }))
  const batches = nodes.filter((node) => Array.isArray(node.props.points))
  expect(
    batches.filter((node) => (node.props.points as object[]).length === 2).length
  ).toBeGreaterThanOrEqual(2)
})

it('keeps tower counts readable separately from long project labels and lights attention', () => {
  const theme = themeForTeam()
  const label = 'An especially long project label'
  const nodes = elements(
    ThemeTower({
      floors: [{ floorId: 'p1', label, agentCount: 20, attentionCount: 2 }],
      palette: theme.palette
    })
  )
  expect(signTexture).toHaveBeenCalledWith(label)
  expect(signTexture).toHaveBeenCalledWith('20 agents · 2 waiting')
  expect(nodes.find((node) => node.type === Lantern)?.props.color).toBe(theme.palette.glow)
})
