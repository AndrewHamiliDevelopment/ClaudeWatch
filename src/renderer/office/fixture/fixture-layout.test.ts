import { expect, it } from 'vitest'
import { buildFixtureFrame } from './fixture-feed'
import { buildLayout } from '../../../office/sim/layout'
import { toFloorGeometry } from '../../office-live/layout-geometry'

it('previews the same nested single floor with companies, projects, agents and permission', () => {
  const frame = buildFixtureFrame(0, 1000000)
  expect(frame.floors).toHaveLength(1)
  expect(frame.floors[0].floorId).toBe('hq')
  expect(frame.floors[0].zones.length).toBeGreaterThanOrEqual(2)
  expect(frame.floors[0].zones.length).toBeLessThanOrEqual(3)
  expect(frame.floors[0].zones.flatMap((c) => c.children).length).toBeGreaterThan(3)
  expect(frame.floors).toEqual(
    toFloorGeometry(buildLayout(frame.sessions, undefined), frame.sessions)
  )
  expect(frame.sessions.filter((s) => s.attention === 'permission')).toHaveLength(1)
  expect(frame.agents.some((a) => a.isSubagent)).toBe(true)
  expect(frame.agents.some((a) => a.slotId.startsWith('team_seat'))).toBe(true)
  for (const agent of frame.agents) {
    const room = frame.floors[0].rooms.find((r) => r.id === agent.roomId)!
    expect(agent.floorId).toBe('hq')
    expect(room).toBeDefined()
    expect(Math.abs(agent.x - room.x)).toBeLessThan(room.width / 2)
    expect(Math.abs(agent.z - room.z)).toBeLessThan(room.depth / 2)
  }
})
