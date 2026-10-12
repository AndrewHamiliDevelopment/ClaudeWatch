import type { FloorGeometry } from '../scene-model'
import { APRON_TOP_Y } from '../themes/apron'
import { GROUND_Y, sceneExtent, WORLD_APRON, type Lot } from '../themes/surroundings'
import { plateCentre } from './zone-framing'

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>

export interface StreetRect extends Rect {
  // The height it is drawn at: just above the ground, or above the apron's paving.
  y: number
}

// Streets are worked out on this lattice, so every edge of one lies on a multiple of it.
export const STREET_CELL_M = 0.5
// Paving reaches this far out from a building; two buildings within twice this share a street.
const STREET_REACH_M = 2
const RING_ROAD_M = 3
const AVENUE_WIDTH_M = 4
// Enough to win the depth test against the ground at the widest zoom.
const LIFT_M = 0.03

const UNPAVED = 0
const ON_GROUND = 1
const ON_APRON = 2

interface Span {
  west: number
  east: number
  north: number
  south: number
}

function spanOf(rect: Rect): Span {
  return {
    west: rect.x - rect.width / 2,
    east: rect.x + rect.width / 2,
    north: rect.z - rect.depth / 2,
    south: rect.z + rect.depth / 2
  }
}

function rectOf({ west, east, north, south }: Span): Rect {
  return { x: (west + east) / 2, z: (north + south) / 2, width: east - west, depth: south - north }
}

function grow(rect: Rect, metres: number): Rect {
  return { ...rect, width: rect.width + metres * 2, depth: rect.depth + metres * 2 }
}

function contains(outer: Rect, point: { x: number; z: number }): boolean {
  return (
    Math.abs(point.x - outer.x) < outer.width / 2 && Math.abs(point.z - outer.z) < outer.depth / 2
  )
}

// The strip from the plate's edge nearest the gate straight out to the edge of the scene.
export function avenueOf(floor: FloorGeometry, extent: Rect): Rect {
  const plate = spanOf({ ...plateCentre(floor), width: floor.width, depth: floor.depth })
  const outer = spanOf(extent)
  const gate = floor.elevator
  const half = AVENUE_WIDTH_M / 2
  const across = { west: gate.x - half, east: gate.x + half }
  const along = { north: gate.z - half, south: gate.z + half }
  const ways: { gap: number; span: Span }[] = [
    { gap: gate.x - plate.west, span: { ...along, west: outer.west, east: plate.west } },
    { gap: plate.east - gate.x, span: { ...along, west: plate.east, east: outer.east } },
    { gap: gate.z - plate.north, span: { ...across, north: outer.north, south: plate.north } },
    { gap: plate.south - gate.z, span: { ...across, north: plate.south, south: outer.south } }
  ]
  return rectOf(ways.reduce((best, way) => (way.gap < best.gap ? way : best)).span)
}

interface Run {
  column: number
  length: number
  level: number
  row: number
}

// Paving on a lattice of cells: marked where a street may run, cleared under anything solid,
// then joined into as few rectangles as cover it.
function createPaving(extent: Rect) {
  const outer = spanOf(extent)
  const westCell = Math.floor(outer.west / STREET_CELL_M)
  const northCell = Math.floor(outer.north / STREET_CELL_M)
  const columns = Math.ceil(outer.east / STREET_CELL_M) - westCell
  const rows = Math.ceil(outer.south / STREET_CELL_M) - northCell
  const cells = new Uint8Array(columns * rows)
  // `isGreedy` takes every cell the rect touches; otherwise only cells wholly inside it.
  const fill = (rect: Rect, value: number, isGreedy: boolean, onlyPaved = false): void => {
    const span = spanOf(rect)
    const [low, high] = isGreedy ? [Math.floor, Math.ceil] : [Math.ceil, Math.floor]
    const first = Math.max(0, low(span.west / STREET_CELL_M) - westCell)
    const last = Math.min(columns, high(span.east / STREET_CELL_M) - westCell)
    const top = Math.max(0, low(span.north / STREET_CELL_M) - northCell)
    const bottom = Math.min(rows, high(span.south / STREET_CELL_M) - northCell)
    for (let row = top; row < bottom; row++)
      for (let column = first; column < last; column++)
        if (!onlyPaved || cells[row * columns + column] !== UNPAVED)
          cells[row * columns + column] = value
  }
  const rectFor = (run: Run, endRow: number): StreetRect => ({
    ...rectOf({
      west: (westCell + run.column) * STREET_CELL_M,
      east: (westCell + run.column + run.length) * STREET_CELL_M,
      north: (northCell + run.row) * STREET_CELL_M,
      south: (northCell + endRow) * STREET_CELL_M
    }),
    y: (run.level === ON_APRON ? APRON_TOP_Y : GROUND_Y) + LIFT_M
  })
  return {
    pave: (rect: Rect) => fill(rect, ON_GROUND, false),
    raise: (rect: Rect) => fill(rect, ON_APRON, false, true),
    clear: (rect: Rect) => fill(rect, UNPAVED, true),
    // A run of paved cells along a row carries on down while the rows below repeat it.
    merged(): StreetRect[] {
      const streets: StreetRect[] = []
      let open = new Map<string, Run>()
      for (let row = 0; row <= rows; row++) {
        const next = new Map<string, Run>()
        for (let column = 0; row < rows && column < columns; ) {
          const level = cells[row * columns + column]
          let length = 1
          while (column + length < columns && cells[row * columns + column + length] === level)
            length++
          if (level !== UNPAVED) {
            const key = `${column}:${length}:${level}`
            next.set(key, open.get(key) ?? { column, length, level, row })
            open.delete(key)
          }
          column += length
        }
        for (const run of open.values()) streets.push(rectFor(run, row))
        open = next
      }
      return streets
    }
  }
}

// The town's roads: paving round every building (so the gaps between rows and columns of lots
// become streets), a ring road between the apron and the first ring, and an avenue from the gate.
// `lots` is everything that stands on the ground, the district's own buildings included.
export function streetRects(floor: FloorGeometry, lots: readonly Lot[]): StreetRect[] {
  const plate: Rect = { ...plateCentre(floor), width: floor.width, depth: floor.depth }
  const { west, east, north, south } = spanOf(plate)
  const apron = rectOf({
    west: west - WORLD_APRON.west,
    east: east + WORLD_APRON.east,
    north: north - WORLD_APRON.north,
    south: south + WORLD_APRON.south
  })
  const extent = sceneExtent(floor, lots)
  const buildings = lots.filter((lot) => lot.kind === 'building')
  const paving = createPaving(extent)
  for (const lot of buildings) if (!contains(apron, lot)) paving.pave(grow(lot, STREET_REACH_M))
  paving.pave(grow(apron, RING_ROAD_M))
  // The apron is the district's own paved ground: only what serves a building or the gate is road.
  paving.clear(apron)
  for (const lot of buildings) if (contains(apron, lot)) paving.pave(grow(lot, STREET_REACH_M))
  paving.pave(avenueOf(floor, extent))
  paving.raise(apron)
  for (const solid of [...lots, plate, ...floor.zones]) paving.clear(solid)
  return paving.merged()
}

// Two triangles a street, wound to face up: every road in one buffer, so one draw.
export function streetVertices(streets: readonly StreetRect[]): Float32Array {
  const vertices = new Float32Array(streets.length * 18)
  streets.forEach(({ y, ...street }, index) => {
    const { west, east, north, south } = spanOf(street)
    vertices.set(
      [
        west,
        y,
        north,
        west,
        y,
        south,
        east,
        y,
        north,
        east,
        y,
        north,
        west,
        y,
        south,
        east,
        y,
        south
      ],
      index * 18
    )
  })
  return vertices
}
