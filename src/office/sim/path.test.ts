import { expect, it } from 'vitest'
import { findPath, type NavGrid } from './path'

it('routes through a door but cannot cross a closed wall', () => {
  const grid: NavGrid = {
    width: 5,
    height: 5,
    cellSize: 0.25,
    origin: { x: 0, z: 0 },
    blocked: ['2,0', '2,1', '2,3', '2,4']
  }
  const path = findPath(grid, { x: 0, z: 0 }, { x: 1, z: 0 })
  expect(path).toContainEqual({ x: 0.5, z: 0.5 })
  expect(
    findPath({ ...grid, blocked: [...grid.blocked, '2,2'] }, { x: 0, z: 0 }, { x: 1, z: 0 })
  ).toEqual([])
})
