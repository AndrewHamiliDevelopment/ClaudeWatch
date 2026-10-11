import { expect, it } from 'vitest'
import { buildLayout } from './layout'
import { session } from './fixtures'
import { officeGrid } from './navigation'
import { findPath } from './path'

it('routes from the gate through company, project and office doors only', () => {
  const floor = buildLayout([session('a')], undefined, 0).floors[0]
  const company = floor.zones[0]
  const project = company.children[0]
  const office = floor.rooms.find((r) => r.sessionKey === 'a')!
  const grid = officeGrid(floor)
  const desk = office.slots.find((s) => s.id === 'desk_main')!
  const path = findPath(grid, floor.elevator, desk)
  expect(path.length).toBeGreaterThan(0)
  for (const zone of [company, project, office]) {
    expect(path.some((p) => p.z === zone.door.z && Math.abs(p.x - zone.door.x) <= 0.5)).toBe(true)
    const sealed = {
      ...grid,
      blocked: [
        ...grid.blocked,
        ...Array.from(
          { length: 5 },
          (_, i) =>
            `${Math.round((zone.door.x - 0.5 + i * 0.25 - grid.origin.x) / 0.25)},${Math.round((zone.door.z - grid.origin.z) / 0.25)}`
        )
      ]
    }
    expect(findPath(sealed, floor.elevator, desk)).toEqual([])
  }
})
