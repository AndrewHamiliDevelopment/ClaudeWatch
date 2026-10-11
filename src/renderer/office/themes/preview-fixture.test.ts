import { describe, expect, it } from 'vitest'
import { previewFixture } from './preview-fixture'

describe('theme preview fixture', () => {
  it('shows a bounded floor, both providers and an apprentice from the shared fixtures', () => {
    const { floor, agents, towerFloors } = previewFixture()
    expect(floor.rooms).toHaveLength(2)
    expect(agents).toHaveLength(3)
    expect(new Set(agents.map((a) => a.provider))).toEqual(new Set(['claude', 'codex']))
    expect(agents.some((a) => a.isSubagent)).toBe(true)
    expect(towerFloors).toHaveLength(3)
    for (const agent of agents) expect(agent.floorId).toBe(floor.floorId)
    expect(previewFixture()).toEqual(previewFixture())
  })
})
