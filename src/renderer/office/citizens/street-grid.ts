import { STREET_CELL_M, type StreetRect } from '../logic/streets'
import { draw } from '../themes/surroundings'
import type { CitizenRoute, RoutePoint } from './route-pose'

export interface StreetGrid {
  westCell: number
  northCell: number
  columns: number
  rows: number
  // 1 on a paved cell. A citizen walks cell centres, a quarter metre in from any kerb.
  open: Uint8Array
  // The open cells' indices, north to south: what a start is drawn from.
  starts: number[]
}

const MAX_LEGS = 6
const LEG_CELLS = { min: 12, max: 44 }
const STEPS = [
  { column: 1, row: 0 },
  { column: 0, row: 1 },
  { column: -1, row: 0 },
  { column: 0, row: -1 }
] as const
// Quarter turns: left, right, and the first leg's "any way that is open".
const LEFT = 1
const RIGHT = 3
const ANY_WAY = [0, LEFT, RIGHT, 2]

const cellOf = (metres: number): number => Math.round(metres / STREET_CELL_M)

type Closed = Pick<StreetRect, 'x' | 'z' | 'width' | 'depth'>

// `closed` is ground no citizen may stand on even where a street crosses it: a company's grounds.
export function streetGrid(
  streets: readonly StreetRect[],
  closed: readonly Closed[] = []
): StreetGrid {
  const spans = streets.map((street) => ({
    west: cellOf(street.x - street.width / 2),
    east: cellOf(street.x + street.width / 2),
    north: cellOf(street.z - street.depth / 2),
    south: cellOf(street.z + street.depth / 2)
  }))
  let westCell = Infinity
  let northCell = Infinity
  let eastCell = -Infinity
  let southCell = -Infinity
  for (const span of spans) {
    westCell = Math.min(westCell, span.west)
    northCell = Math.min(northCell, span.north)
    eastCell = Math.max(eastCell, span.east)
    southCell = Math.max(southCell, span.south)
  }
  const columns = spans.length ? eastCell - westCell : 0
  const rows = spans.length ? southCell - northCell : 0
  const open = new Uint8Array(columns * rows)
  for (const span of spans)
    for (let row = span.north - northCell; row < span.south - northCell; row++)
      open.fill(1, row * columns + span.west - westCell, row * columns + span.east - westCell)
  for (const rect of closed) {
    const west = Math.max(0, cellOf(rect.x - rect.width / 2) - westCell)
    const east = Math.min(columns, cellOf(rect.x + rect.width / 2) - westCell)
    const north = Math.max(0, cellOf(rect.z - rect.depth / 2) - northCell)
    const south = Math.min(rows, cellOf(rect.z + rect.depth / 2) - northCell)
    for (let row = north; row < south; row++)
      if (east > west) open.fill(0, row * columns + west, row * columns + east)
  }
  const starts: number[] = []
  open.forEach((isOpen, cell) => {
    if (isOpen) starts.push(cell)
  })
  return { westCell, northCell, columns, rows, open, starts }
}

// How many cells can be walked straight on from `cell`, up to `wanted`.
function clearRun(grid: StreetGrid, cell: number, way: number, wanted: number): number {
  const step = STEPS[way]
  let column = cell % grid.columns
  let row = Math.floor(cell / grid.columns)
  let cells = 0
  while (cells < wanted) {
    column += step.column
    row += step.row
    if (column < 0 || column >= grid.columns || row < 0 || row >= grid.rows) break
    if (!grid.open[row * grid.columns + column]) break
    cells++
  }
  return cells
}

function centreOf(grid: StreetGrid, cell: number): RoutePoint {
  return {
    x: (grid.westCell + (cell % grid.columns) + 0.5) * STREET_CELL_M,
    z: (grid.northCell + Math.floor(cell / grid.columns) + 0.5) * STREET_CELL_M
  }
}

// Straight legs along the paving with a quarter turn between them: never back on itself.
export function routeFrom(grid: StreetGrid, start: number, seed: number): CitizenRoute {
  const points = [centreOf(grid, start)]
  let cell = start
  let heading = Math.floor(draw(seed, 1) * STEPS.length)
  let cellsWalked = 0
  for (let leg = 0; leg < MAX_LEGS; leg++) {
    const wanted = Math.round(
      LEG_CELLS.min + (LEG_CELLS.max - LEG_CELLS.min) * draw(seed, 2 + leg * 2)
    )
    const turn = draw(seed, 3 + leg * 2) < 0.5 ? LEFT : RIGHT
    const turns = leg === 0 ? ANY_WAY : [turn, STEPS.length - turn]
    const ways = turns.map((quarter) => (heading + quarter) % STEPS.length)
    const way = ways.find((candidate) => clearRun(grid, cell, candidate, 1) > 0)
    if (way === undefined) break
    const cells = clearRun(grid, cell, way, wanted)
    cell += (STEPS[way].column + STEPS[way].row * grid.columns) * cells
    points.push(centreOf(grid, cell))
    heading = way
    cellsWalked += cells
  }
  return { points, length: cellsWalked * STREET_CELL_M }
}
