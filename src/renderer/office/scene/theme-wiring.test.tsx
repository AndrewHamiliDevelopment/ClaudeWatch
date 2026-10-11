import { isValidElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { signTexture } from './textures'
import { Lantern } from '../themes/primitives'
import { Robot } from './Robot'
import { FloorView } from './FloorView'
import { WorldView } from './WorldView'
import { ParkedFrames } from '../themes/ParkedFrames'
import { ThemeTower } from '../themes/WorldArchitecture'
import { themeForTeam } from '../themes/registry'
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
  const nodes = elements(FloorView({ floor, theme, wallsMode: 'cutaway', isReducedMotion: true }))
  for (const Component of Object.values(theme.kit)) {
    expect(nodes.some((node) => node.type === Component)).toBe(true)
  }
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
