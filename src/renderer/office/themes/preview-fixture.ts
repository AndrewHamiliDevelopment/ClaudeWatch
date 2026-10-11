import { buildFixtureFrame } from '../fixture/fixture-feed'
import { agentsForFloor, layoutFloor } from '../fixture/fixture-layout'
import type { TowerFloor } from './types'

export function previewFixture() {
  const frame = buildFixtureFrame(2, 0)
  const original = frame.floors[0]
  // A small cast that shows both providers and an apprentice: one Claude lead with a subagent and one Codex agent.
  const claudeLead = frame.sessions.find((s) => s.provider === 'claude' && s.subagents.length > 0)
  const codexAgent = frame.sessions.find((s) => s.provider === 'codex')
  const sessions = [claudeLead, codexAgent]
    .filter((s) => s !== undefined)
    .map((s) => ({ ...s, subagents: s.subagents.slice(0, 1) }))
  // The showcase shows the agents' own offices; team areas belong to the live floor.
  const laidOut = layoutFloor({ ...original, sessions })
  const floor = { ...laidOut, rooms: laidOut.rooms.filter((room) => room.sessionKey !== null) }
  // One floor now: the tower's storeys stand for the projects on it.
  const projectKeys = [...new Set(frame.sessions.map((s) => s.projectKey))]
  const towerFloors: TowerFloor[] = projectKeys.map((projectKey) => {
    const projectSessions = frame.sessions.filter((s) => s.projectKey === projectKey)
    return {
      floorId: projectKey,
      label: projectSessions[0].projectLabel,
      agentCount: projectSessions.length,
      attentionCount: projectSessions.filter(
        (s) => s.attention === 'permission' || s.attention === 'question' || s.attention === 'error'
      ).length
    }
  })
  return { floor, agents: agentsForFloor(floor, sessions), towerFloors }
}
