import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { expect, it, vi } from 'vitest'
import { makeFloor, makeZone } from '../__tests__/fixtures'
import { groupZonesByTheme } from '../logic/office-themes'
import { getTheme, registerTheme } from '../themes/registry'
import { withBoxSurroundings } from '../themes/scene.test-utils'
import { surroundingLots, type Lot } from '../themes/surroundings'
import type { OfficeTheme } from '../themes/types'
import { BatchedScene } from './BatchedScene'
import { lotsByTheme, SurroundingsView } from './WorldView'

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory()
}))

const edo = getTheme('neo-edo-steam')
const filledEdo = withBoxSurroundings(edo, 'test-filled-edo')
const filledBrass = withBoxSurroundings(getTheme('brass-workshop'), 'test-filled-brass')
registerTheme(filledEdo)
registerTheme(filledBrass)
// Edo with no world of its own: a theme that draws neither surroundings nor ambient life.
const { Surroundings: _surroundings, Ambient: _ambient, ...bareZone } = edo.kit.zone
const bareEdo: OfficeTheme = { ...edo, id: 'test-bare-edo', kit: { ...edo.kit, zone: bareZone } }
registerTheme(bareEdo)

function company(id: string, x: number) {
  return makeZone({
    id,
    kind: 'company',
    companyKey: id,
    x,
    z: 0,
    width: 20,
    depth: 16,
    door: { x, z: 8 },
    children: [makeZone({ id: `${id}/p`, kind: 'project', x, z: 0, width: 14, depth: 10 })]
  })
}

const floor = makeFloor({
  floorId: 'hq',
  width: 60,
  depth: 24,
  corridor: { z: 11, width: 2 },
  elevator: { x: -28, z: 11 },
  zones: [company('c_a', -15), company('c_b', 15)]
})
const lots = surroundingLots(floor)
const themeIdFor = (zone: { companyKey: string | null }): string =>
  zone.companyKey === 'c_b' ? filledBrass.id : filledEdo.id

type Node = ReactElement<{ children?: ReactNode; lots?: readonly Lot[]; revision?: string }>

function elements(node: ReactNode): Node[] {
  if (Array.isArray(node)) return node.flatMap(elements)
  if (!isValidElement<Node['props']>(node)) return []
  return [node, ...elements(node.props.children)]
}

function view(
  floorTheme = filledEdo,
  themeFor = themeIdFor,
  drawnLots: readonly Lot[] = lots,
  isReducedMotion = false
) {
  return SurroundingsView({
    floor,
    floorTheme,
    zoneGroups: groupZonesByTheme(floor, themeFor),
    lots: drawnLots,
    isReducedMotion
  })
}

it('hands each company its own lots and the far ring to the floor theme', () => {
  const groups = lotsByTheme(lots, groupZonesByTheme(floor, themeIdFor), filledEdo.id)
  const byTheme = new Map(groups.map((group) => [group.themeId, group.lots]))
  expect(byTheme.get(filledBrass.id)?.every((lot) => lot.zoneId === 'c_b')).toBe(true)
  expect(byTheme.get(filledEdo.id)?.every((lot) => lot.zoneId !== 'c_b')).toBe(true)
  expect(byTheme.get(filledEdo.id)?.some((lot) => lot.zoneId === null)).toBe(true)
  expect(groups.flatMap((group) => group.lots)).toHaveLength(lots.length)
})

it('gives a lot whose company is gone to the floor theme', () => {
  const orphan: Lot = { ...lots[0], zoneId: 'c_gone' }
  expect(lotsByTheme([orphan], groupZonesByTheme(floor, themeIdFor), filledEdo.id)).toEqual([
    { themeId: filledEdo.id, lots: [orphan] }
  ])
})

it('draws each theme its own lots, merged in one batch', () => {
  const scene = view()
  expect(scene?.type).toBe(BatchedScene)
  const nodes = elements(scene)
  for (const theme of [filledEdo, filledBrass]) {
    const drawn = nodes.find((node) => node.type === theme.kit.zone.Surroundings)
    const expected = lots.filter((lot) =>
      theme === filledBrass ? lot.zoneId === 'c_b' : lot.zoneId !== 'c_b'
    )
    expect(expected.length).toBeGreaterThan(0)
    expect(drawn?.props.lots).toEqual(expected)
    expect(nodes.some((node) => node.type === theme.kit.zone.Ambient)).toBe(true)
  }
})

it('mounts nothing, and so costs no frame work, when no theme draws surroundings', () => {
  expect(bareEdo.kit.zone.Surroundings).toBeUndefined()
  expect(view(bareEdo, () => bareEdo.id)).toBeNull()
})

it('rebuilds the merge only when the lots, a theme or reduced motion changes', () => {
  const revision = (...args: Parameters<typeof view>): string | undefined =>
    view(...args)?.props.revision
  expect(revision()).toBe(revision(filledEdo, themeIdFor, surroundingLots(structuredClone(floor))))
  expect(revision()).not.toBe(revision(filledEdo, themeIdFor, lots.slice(1)))
  expect(revision()).not.toBe(revision(filledEdo, () => filledEdo.id))
  expect(revision()).not.toBe(revision(filledEdo, themeIdFor, lots, true))
})
