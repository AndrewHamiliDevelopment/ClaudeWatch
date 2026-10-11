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

const open: NavGrid = { width: 9, height: 9, cellSize: 0.25, origin: { x: 0, z: 0 }, blocked: [] }

it('starts and ends on the exact points, not on the nearest grid cells', () => {
  const from = { x: 0.1, z: 0.05 }
  const to = { x: 1.6, z: 1.45 }
  const path = findPath(open, from, to)
  expect(path[0]).toEqual(from)
  expect(path.at(-1)).toEqual(to)
  expect(path.length).toBeGreaterThan(4)
})

it('walks off a wall that was built where the walker stands', () => {
  const walled: NavGrid = { ...open, blocked: ['4,0', '4,1', '4,2', '4,3', '4,4'] }
  const from = { x: 1, z: 0.5 }
  const path = findPath(walled, from, { x: 0, z: 2 })
  expect(path[0]).toEqual(from)
  expect(path.at(-1)).toEqual({ x: 0, z: 2 })
})
