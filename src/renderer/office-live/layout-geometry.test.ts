import { describe, it, expect } from 'vitest'
import { buildLayout } from '../../office/sim/layout'
import { session } from '../../office/sim/fixtures'
import { placements } from '../../office/sim/placements'
import { toFloorGeometry, toSceneAgent } from './layout-geometry'
import type { AgentView } from '../../shared/office/types'

const sessions = [
  session('a'),
  session('b'),
  { ...session('c', 'p_b'), companyKey: 'c_second', companyLabel: 'Second' }
]

describe('headquarters geometry', () => {
  it('nests company > project > office/team and flattens precisely the leaves', () => {
    const layout = buildLayout(sessions, undefined, 0)
    const floors = toFloorGeometry(layout, sessions)
    expect(floors).toHaveLength(1)
    const floor = floors[0]
    expect(floor.floorId).toBe('hq')
    expect(floor.zones.map((z) => z.label)).toEqual(['Second', 'Work'])
    for (const company of floor.zones) {
      expect(company.kind).toBe('company')
      for (const project of company.children) {
        expect(project.kind).toBe('project')
        expect(project.children.some((z) => z.kind === 'team')).toBe(true)
        for (const leaf of project.children) {
          expect(floor.rooms.find((r) => r.id === leaf.id)).toMatchObject({
            x: leaf.x,
            z: leaf.z,
            door: leaf.door,
            label: leaf.label
          })
          expect(leaf.children).toEqual([])
        }
      }
    }
    expect(floor.rooms).toHaveLength(5)
  })
  it('uses the same origin-centred metre frame for zones, leaves, entrance and agents', () => {
    const layout = buildLayout(sessions, undefined, 0)
    const floor = toFloorGeometry(layout, sessions)[0]
    expect(floor.corridor.width).toBeGreaterThanOrEqual(3)
    expect(floor.elevator).toEqual({ x: 0, z: 0 })
    for (const zone of floor.zones) {
      expect(Math.abs(zone.x) + zone.width / 2).toBeLessThanOrEqual(floor.width / 2)
      expect(Math.abs(zone.z) + zone.depth / 2).toBeLessThanOrEqual(floor.depth / 2)
    }
    for (const placement of placements(sessions, layout)) {
      const view: AgentView = {
        ...placement.slot,
        agentKey: placement.session.key,
        floorId: placement.floorId,
        roomId: placement.room.id,
        slotId: placement.slot.id,
        activity: 'idle',
        attention: 'none',
        provider: 'claude',
        isSubagent: false,
        label: placement.session.name
      }
      const agent = toSceneAgent(view)
      expect(agent).toEqual(view)
      const room = floor.rooms.find((r) => r.id === agent.roomId)!
      expect(Math.abs(agent.x - room.x)).toBeLessThan(room.width / 2)
      expect(Math.abs(agent.z - room.z)).toBeLessThan(room.depth / 2)
    }
  })
})

it('provides one empty headquarters floor before any sessions arrive', () => {
  const floors = toFloorGeometry({ version: 1, floors: [], reservations: {} }, [])
  expect(floors).toHaveLength(1)
  expect(floors[0]).toMatchObject({ floorId: 'hq', rooms: [], zones: [] })
})
