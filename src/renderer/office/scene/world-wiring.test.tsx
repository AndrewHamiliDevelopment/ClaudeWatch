import { isValidElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { BAND_ZOOM } from '../logic/camera-bands'
import { Lantern } from '../themes/primitives'
import { getTheme, themeForTeam } from '../themes/registry'
import { ThemeTower } from '../themes/WorldArchitecture'
import { signTexture } from './textures'
import { LotFill } from '../themes/LotFill'
import { GROUND_Y } from '../themes/surroundings'
import { townLandmark } from '../town/TownView'
import { LARGE_FLOOR, widened } from '../town/town.test-utils'
import { townOf } from '../town/use-town-plan'
import { TowerView } from './WorldView'

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

const edo = getTheme('neo-edo-steam')
const brass = getTheme('brass-workshop')

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

const { plan } = townOf(LARGE_FLOOR, null, 'full')
const storeys = [{ floorId: 'p1', label: 'Office', agentCount: 3, attentionCount: 0 }]
const tower = (band: 'floor' | 'building', theme = edo, town = plan, floors = storeys) =>
  TowerView({ plan: town, theme, floors, band })

it('stands the tower on the civic landmark lot, in the building band alone', () => {
  const lot = townLandmark(plan)
  if (!lot) throw new Error('the seeded town has no civic landmark')
  const far = elements(tower('building'))
  const stand = far.find(
    (node) => elements(node.props.children as ReactNode)[0]?.type === edo.world.Tower
  )
  expect(stand?.props.position).toEqual([lot.x, GROUND_Y, lot.z])
  // One floor now: the Tower is a landmark and never switches floors.
  const landmark = elements(stand?.props.children as ReactNode)[0]
  expect(landmark?.props.onFocusFloor).toBeUndefined()
  expect(far.some((node) => node.type === LotFill)).toBe(false)
  expect(elements(tower('floor')).some((node) => node.type === edo.world.Tower)).toBe(false)
})

it('dresses the landmark lot as a civic building until the tower takes it', () => {
  const lot = townLandmark(plan)
  const fill = elements(tower('floor')).find((node) => node.type === LotFill)
  const placed = fill?.props.placed as { lot: { id: string }; parts: unknown[] }[]
  expect(placed.map((each) => each.lot.id)).toEqual([lot?.id])
  expect(placed[0].parts.length).toBeGreaterThan(0)
})

it('places the tower once, and again only for a new band, theme, storey or landmark', () => {
  const revision = (...args: Parameters<typeof tower>): string =>
    (tower(...args)?.props as { revision: string; isStatic: boolean }).revision
  expect((tower('floor')?.props as { isStatic: boolean }).isStatic).toBe(true)
  const unmoved = townOf(structuredClone(LARGE_FLOOR), null, 'full').plan
  expect(revision('floor', edo, unmoved, structuredClone(storeys))).toBe(revision('floor'))
  expect(revision('building')).not.toBe(revision('floor'))
  expect(revision('floor', brass)).not.toBe(revision('floor'))
  expect(revision('building', edo, plan, [...storeys, ...storeys])).not.toBe(revision('building'))
  // The old town never moves: the campus growing east leaves the tower where it stands.
  const grown = townOf(widened(LARGE_FLOOR, 30), null, 'full').plan
  expect(grown.claim).not.toEqual(plan.claim)
  expect(revision('floor', edo, grown)).toBe(revision('floor'))
})
