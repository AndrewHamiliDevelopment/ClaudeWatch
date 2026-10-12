import { createElement, type ComponentType } from 'react'
import { expect, it, vi } from 'vitest'
import { Texture } from 'three'
import { FloorView } from '../scene/FloorView'
import { Horizon } from '../scene/Horizon'
import { RobotCrew } from '../scene/Robot'
import { SurroundingsView, WorldView } from '../scene/WorldView'
import { getTheme, listThemes, registerTheme } from './registry'
import { mergedDraws, withBoxSurroundings } from './scene.test-utils'
import { GROUND_Y, LOT_CAP, sceneExtent, surroundingLots } from './surroundings'
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
vi.mock('@react-three/drei', () => ({ CameraControlsImpl: class {} }))
vi.mock('../scene/textures', () => ({
  signTexture: () => new Texture(),
  blobShadowTexture: () => new Texture()
}))

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

// An upper bound: every thought dot and steam puff at once, and the world at building zoom.
function measure({ floor, agents, floorTheme, themeIdFor }: Composition) {
  const zoneGroups = groupZonesByTheme(floor, themeIdFor)
  // Each layer merges on its own, as its own BatchedScene does at runtime.
  const focused = mergedDraws([
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
  const world = mergedDraws(
    createElement(WorldView, {
      floor,
      theme: floorTheme,
      band: 'building',
      floors: [
        { floorId: floor.floorId, label: floor.label, agentCount: agents.length, attentionCount: 2 }
      ]
    })
  )
  const lots = surroundingLots(floor)
  const horizon = mergedDraws(
    createElement(Horizon, {
      box: { ...sceneExtent(floor, lots), minY: GROUND_Y, maxY: 1 },
      color: floorTheme.palette.stone
    })
  )
  const surroundings = mergedDraws(
    createElement(SurroundingsView, { floor, floorTheme, zoneGroups, lots, isReducedMotion: true })
  )
  return {
    themeCount: zoneGroups.length,
    lotCount: lots.length,
    worldDraws: world.draws,
    horizonDraws: horizon.draws,
    surroundingsDraws: surroundings.draws,
    draws: focused.draws + world.draws + horizon.draws + surroundings.draws,
    triangles: focused.triangles + world.triangles + horizon.triangles + surroundings.triangles
  }
}

function agentsOn(companyCount: number, agentCount = 20): Pick<Composition, 'floor' | 'agents'> {
  const sessions = Array.from({ length: agentCount }, (_, i) =>
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
  expect(agents).toHaveLength(agentCount)
  return { floor, agents }
}

function report(name: string, result: ReturnType<typeof measure>): void {
  console.info(
    `${name}: ${result.draws} draw calls (${result.worldDraws} world, ${result.surroundingsDraws} surroundings on ${result.lotCount} lots), ${result.triangles} triangles`
  )
}

for (const theme of listThemes())
  it(`${theme.id} live composition with 20 agents stays below 300 draws and 600k triangles`, () => {
    const result = measure({ ...agentsOn(1), floorTheme: theme, themeIdFor: () => theme.id })
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
    ...agentsOn(4),
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
    ...agentsOn(4),
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
    ...agentsOn(4),
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
    ...agentsOn(4),
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

const THREE_THEMES = [EDO, 'violet-court', 'orbital-garrison']

function scaled(themeIds: readonly string[], agentCount: number, companyCount: number) {
  const result = measure({
    ...agentsOn(companyCount, agentCount),
    floorTheme: getTheme(themeIds[0]),
    themeIdFor: companyThemes(themeIds)
  })
  report(`${themeIds.join(' + ')}, ${companyCount} companies, ${agentCount} agents`, result)
  return result
}

it.each([
  [20, 4],
  [30, 4],
  [40, 4],
  [60, 10]
])(
  '%i agents in %i companies on a three-theme floor stay inside the draw ceiling',
  (agents, companies) => {
    const result = scaled(THREE_THEMES, agents, companies)
    expect(result.themeCount).toBe(3)
    expect(result.draws).toBeLessThanOrEqual(DRAW_CEILING)
    expect(result.triangles).toBeLessThanOrEqual(TRIANGLE_CEILING)
  }
)

// Stand-ins for the three themes once each draws its lots: its own cost, plus four box parts.
const FILLED_THEMES = THREE_THEMES.map((themeId) => {
  const filled = withBoxSurroundings(getTheme(themeId), `test-filled-${themeId}`)
  registerTheme(filled)
  return filled.id
})
// A body, a roof, a crate and a mover per theme, however many lots there are.
const FIXTURE_DRAWS_PER_THEME = 4

it.each([
  [20, 4],
  [40, 4],
  [60, 10]
])(
  '%i agents in %i companies on three themes that fill their lots stay inside the draw ceiling',
  (agents, companies) => {
    const result = scaled(FILLED_THEMES, agents, companies)
    expect(result.themeCount).toBe(3)
    expect(result.lotCount).toBeGreaterThan(40)
    expect(result.lotCount).toBeLessThanOrEqual(LOT_CAP)
    expect(result.horizonDraws).toBe(1)
    expect(result.surroundingsDraws).toBe(3 * FIXTURE_DRAWS_PER_THEME)
    expect(result.draws).toBeLessThanOrEqual(DRAW_CEILING)
    expect(result.triangles).toBeLessThanOrEqual(TRIANGLE_CEILING)
  }
)

it('adds nothing but the ground while no theme fills its lots', () => {
  const result = scaled(THREE_THEMES, 20, 4)
  expect(result.surroundingsDraws).toBe(0)
  expect(result.horizonDraws).toBe(1)
})

// What an agent may add once the floor's parts are merged: the textured door sign of its room.
const DRAWS_PER_AGENT = 1

it.each([
  ...listThemes().map((theme) => [theme.id, [theme.id]] as const),
  ['three themes', THREE_THEMES] as const
])('%s adds at most one draw per agent', (_name, themeIds) => {
  const perAgent = (scaled(themeIds, 40, 4).draws - scaled(themeIds, 20, 4).draws) / 20
  expect(perAgent).toBeLessThanOrEqual(DRAWS_PER_AGENT)
})
