import { isValidElement, type ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { session } from '../../../office/sim/fixtures'
import { buildLayout } from '../../../office/sim/layout'
import { toFloorGeometry } from '../../office-live/layout-geometry'
import { groupZonesByTheme } from '../logic/office-themes'
import type { FloorGeometry } from '../scene-model'
import { themeForTeam } from '../themes/registry'
import { FloorView } from './FloorView'
import { WorldView } from './WorldView'

// The views are called as plain functions here, so their one hook is stood in for.
vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: (factory: () => object) => factory()
}))

type Seed = [company: string, project: string, sessions: number][]
const ZKIDZ: Seed = [
  ['zkidz', '1', 3],
  ['zkidz', '2', 2],
  ['zkidz', '3', 1],
  ['zkidz', '4', 2]
]
const sessionsOf = (seed: Seed) =>
  seed.flatMap(([company, project, count]) =>
    Array.from({ length: count }, (_, seat) => ({
      ...session(`${company}-${project}-${seat}`, `p_${company}_${project}`),
      companyKey: `c_${company}`,
      companyLabel: company
    }))
  )

interface Found {
  props: Record<string, unknown>
  // Where the part's own origin lands in the world: the groups around it, added up.
  at: [number, number, number]
}

function locate(node: ReactNode, type: unknown, at: Found['at'] = [0, 0, 0]): Found | undefined {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = locate(child, type, at)
      if (found) return found
    }
    return undefined
  }
  if (!isValidElement<Record<string, unknown>>(node)) return undefined
  if (node.type === type) return { props: node.props, at }
  const { position, children } = node.props
  const [x = 0, y = 0, z = 0]: number[] =
    node.type === 'group' && Array.isArray(position) ? position : []
  return locate(children as ReactNode, type, [at[0] + x, at[1] + y, at[2] + z])
}

const theme = themeForTeam()

describe.each([
  ['a lone company', ZKIDZ, { x: 34, z: 7 }],
  ['the owner-like floor', [...ZKIDZ, ['alpha', '1', 1], ['beta', '1', 1]] as Seed, { x: 34, z: 0 }]
])('theme parts on the plate of %s', (_name, seed, centre) => {
  const sessions = sessionsOf(seed)
  const layout = buildLayout(sessions, undefined, 0)
  const floor = toFloorGeometry(layout, sessions)[0]
  const floorView = FloorView({
    floor,
    floorTheme: theme,
    zoneGroups: groupZonesByTheme(floor, () => theme.id),
    wallsMode: 'cutaway',
    isReducedMotion: true
  })

  it('draws the lift on the very point where the sim lets agents in', () => {
    const gate = layout.floors[0].elevator
    const lift = locate(floorView, theme.kit.floor.Elevator)!
    const drawn = lift.props.floor as FloorGeometry
    expect([lift.at[0] + drawn.elevator.x, lift.at[2] + drawn.elevator.z]).toEqual([gate.x, gate.z])
    expect([gate.x, gate.z]).toEqual([0, 0])
  })

  it('lays the slab on the plate and its lane on the street', () => {
    const slab = locate(floorView, theme.kit.floor.Slab)!
    const drawn = slab.props.floor as FloorGeometry
    expect([slab.at[0], slab.at[2]]).toEqual([centre.x, centre.z])
    expect(drawn).toMatchObject({ width: floor.width, depth: floor.depth, x: 0, z: 0 })
    expect(slab.at[2] + drawn.corridor.z).toBe(0)
  })

  it('leaves companies in the coordinates the sim gave them', () => {
    const company = locate(floorView, theme.kit.zone.CompanyZone)!
    expect(company.at).toEqual([0, 0, 0])
    expect(floor.zones).toContain(company.props.zone)
  })

  it('stands the district, the hangar and the tower around the plate', () => {
    const world = WorldView({ floor, theme, floors: [], band: 'building' })
    for (const part of [theme.world.District, theme.world.Hangar]) {
      const found = locate(world, part)!
      expect([found.at[0], found.at[2]]).toEqual([centre.x, centre.z])
      expect(found.props.floor).toMatchObject({
        width: floor.width,
        depth: floor.depth,
        x: 0,
        z: 0
      })
    }
    const tower = locate(world, theme.world.Tower)!
    expect([tower.at[0], tower.at[2]]).toEqual([
      centre.x + floor.width / 2 + 7,
      centre.z - floor.depth / 2 - 8
    ])
  })
})

it('rebuilds the district when the plate moves under the same size', () => {
  const sized = { floorId: 'f', label: 'f', plate: 0, width: 40, depth: 20 }
  const rest = { corridor: { z: 0, width: 3 }, rooms: [], zones: [], elevator: { x: 0, z: 0 } }
  const revisionAt = (x: number) =>
    WorldView({ floor: { ...sized, ...rest, x, z: 0 }, theme, floors: [], band: 'floor' }).props
      .revision
  expect(revisionAt(10)).not.toBe(revisionAt(0))
})
