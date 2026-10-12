import { describe, expect, it } from 'vitest'
import { buildFixtureFrame } from '../fixture/fixture-feed'
import { avenueOf, STREET_CELL_M, streetRects, streetVertices } from '../logic/streets'
import { plateCentre } from '../logic/zone-framing'
import { apronLots } from '../themes/apron'
import { GROUND_Y, sceneExtent, surroundingLots, type Lot } from '../themes/surroundings'
import { makeFloor } from './fixtures'

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>

const EDGE_EPSILON_M = 1e-6

function overlaps(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 - EDGE_EPSILON_M &&
    Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - EDGE_EPSILON_M
  )
}

function seededTown() {
  const [floor] = buildFixtureFrame(0, 0).floors
  const centre = plateCentre(floor)
  const district = apronLots(floor).map((lot) => ({
    ...lot,
    x: lot.x + centre.x,
    z: lot.z + centre.z
  }))
  const lots = [...surroundingLots(floor), ...district]
  return { floor, lots, plate: { ...centre, width: floor.width, depth: floor.depth } }
}

const cellOf = (metres: number): number => Math.round(metres / STREET_CELL_M)

// Every street cell, keyed by its lattice position.
function pavedCells(rects: readonly Rect[]): Set<string> {
  const cells = new Set<string>()
  for (const rect of rects) {
    const west = cellOf(rect.x - rect.width / 2)
    const north = cellOf(rect.z - rect.depth / 2)
    for (let column = 0; column < cellOf(rect.width); column++)
      for (let row = 0; row < cellOf(rect.depth); row++)
        cells.add(`${west + column},${north + row}`)
  }
  return cells
}

describe('streetRects', () => {
  it('lays streets on the seeded town', () => {
    const { floor, lots } = seededTown()
    expect(streetRects(floor, lots).length).toBeGreaterThan(50)
  })

  it('never lays a street over a lot, the plate or a company', () => {
    const { floor, lots, plate } = seededTown()
    const solids: Rect[] = [...lots, plate, ...floor.zones]
    for (const street of streetRects(floor, lots))
      expect(solids.filter((solid) => overlaps(street, solid))).toEqual([])
  })

  it('keeps every street just above the ground it lies on', () => {
    const { floor, lots } = seededTown()
    for (const street of streetRects(floor, lots)) {
      expect(street.y).toBeGreaterThan(GROUND_Y)
      expect(street.y).toBeLessThan(0)
    }
  })

  it('runs the avenue from the gate out to the edge of the ring', () => {
    const { floor, lots, plate } = seededTown()
    const paved = pavedCells(streetRects(floor, lots))
    const avenue = avenueOf(floor, sceneExtent(floor, lots))
    // The seeded gate stands by the plate's west edge, so the avenue runs west.
    expect(avenue.x + avenue.width / 2).toBeCloseTo(plate.x - plate.width / 2)
    const start = `${cellOf(plate.x - plate.width / 2) - 1},${cellOf(floor.elevator.z)}`
    expect(paved.has(start)).toBe(true)
    const outerColumn = cellOf(avenue.x - avenue.width / 2) + 1
    const seen = new Set([start])
    const queue = [start]
    let hasReachedEdge = false
    for (let cell = queue.shift(); cell !== undefined; cell = queue.shift()) {
      const [column, row] = cell.split(',').map(Number)
      if (column <= outerColumn) hasReachedEdge = true
      for (const [dx, dz] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1]
      ]) {
        const next = `${column + dx},${row + dz}`
        if (!paved.has(next) || seen.has(next)) continue
        seen.add(next)
        queue.push(next)
      }
    }
    expect(hasReachedEdge).toBe(true)
  })

  it('still lays the ring road and the avenue round a floor with no lots', () => {
    const floor = makeFloor({ floorId: 'bare', elevator: { x: 0, z: 0 } })
    const streets = streetRects(floor, [])
    expect(streets.length).toBeGreaterThan(0)
    const plate = { x: 0, z: 0, width: floor.width, depth: floor.depth }
    expect(streets.filter((street) => overlaps(street, plate))).toEqual([])
  })
})

describe('streetVertices', () => {
  it('draws two triangles for each street, in one buffer', () => {
    const vertices = streetVertices([
      { x: 0, z: 0, width: 2, depth: 1, y: -0.4 },
      { x: 5, z: 5, width: 1, depth: 1, y: -0.2 }
    ])
    expect(vertices).toHaveLength(2 * 6 * 3)
    expect([...vertices.slice(0, 3)]).toEqual([-1, expect.closeTo(-0.4), -0.5])
  })
})
