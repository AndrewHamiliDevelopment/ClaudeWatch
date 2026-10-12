import { createElement } from 'react'
import { expect } from 'vitest'
import type { AgentView } from '../../../shared/office/types'
import { makeSession } from '../__tests__/fixtures'
import { agentsForFloor, layoutFloor } from '../fixture/fixture-layout'
import { groupZonesByTheme, type ThemedZone } from '../logic/office-themes'
import type { FloorGeometry } from '../scene-model'
import { FloorView } from '../scene/FloorView'
import { Horizon } from '../scene/Horizon'
import { RobotCrew } from '../scene/Robot'
import { SurroundingsView, WorldView } from '../scene/WorldView'
import { getTheme, listThemes } from './registry'
import { mergedDraws } from './scene.test-utils'
import { GROUND_Y, sceneExtent, surroundingLots } from './surroundings'
import type { OfficeTheme } from './types'

export const DRAW_CEILING = 300
export const TRIANGLE_CEILING = 600_000
// What a theme may add for its surroundings, lounge and ambient life together.
export const ADDED_DRAWS_PER_THEME = 9
export const EDO = 'neo-edo-steam'
export const BRASS = 'brass-workshop'
// The shipped themes, listed before any test stand-in is registered.
export const REAL_THEMES = listThemes()

export interface Composition {
  floor: FloorGeometry
  agents: readonly AgentView[]
  floorTheme: OfficeTheme
  themeIdFor: (zone: ThemedZone) => string
}

// An upper bound: every thought dot and steam puff at once, and the world at building zoom.
export function measure({ floor, agents, floorTheme, themeIdFor }: Composition) {
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
    focusedDraws: focused.draws,
    worldDraws: world.draws,
    horizonDraws: horizon.draws,
    surroundingsDraws: surroundings.draws,
    draws: focused.draws + world.draws + horizon.draws + surroundings.draws,
    triangles: focused.triangles + world.triangles + horizon.triangles + surroundings.triangles
  }
}

export function agentsOn(
  companyCount: number,
  agentCount = 20
): Pick<Composition, 'floor' | 'agents'> {
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

export function report(name: string, result: ReturnType<typeof measure>): void {
  console.info(
    `${name}: ${result.draws} draw calls (${result.worldDraws} world, ${result.surroundingsDraws} surroundings on ${result.lotCount} lots), ${result.triangles} triangles`
  )
}

export const companyThemes =
  (themeIds: readonly string[]) =>
  (zone: ThemedZone): string =>
    themeIds[Number(zone.companyKey?.slice(2) ?? 0) % themeIds.length]

export const THREE_THEMES = [EDO, 'violet-court', 'orbital-garrison']

export function scaled(themeIds: readonly string[], agentCount: number, companyCount: number) {
  const result = measure({
    ...agentsOn(companyCount, agentCount),
    floorTheme: getTheme(themeIds[0]),
    themeIdFor: companyThemes(themeIds)
  })
  report(`${themeIds.join(' + ')}, ${companyCount} companies, ${agentCount} agents`, result)
  return result
}
