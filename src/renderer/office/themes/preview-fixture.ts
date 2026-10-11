import { buildFixtureFrame } from '../fixture/fixture-feed'
import { agentsForFloor, layoutFloor } from '../fixture/fixture-layout'
import type { TowerFloor } from './types'

export function previewFixture() {
  const frame = buildFixtureFrame(2, 0)
  const original = frame.floors[0]
  const sessions = frame.sessions
    .filter((s) => s.projectKey === original.floorId)
    .slice(0, 2)
    .map((s) => ({ ...s, subagents: s.subagents.slice(0, 1) }))
  const floor = layoutFloor({ ...original, sessions })
  const towerFloors: TowerFloor[] = frame.floors.map((f) => ({
    floorId: f.floorId,
    label: f.label,
    attentionCount: frame.agents.filter(
      (a) =>
        a.floorId === f.floorId &&
        (a.attention === 'permission' || a.attention === 'question' || a.attention === 'error')
    ).length
  }))
  return { floor, agents: agentsForFloor(floor, sessions), towerFloors }
}
