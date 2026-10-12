import { boundsOfZone } from '../logic/zone-framing'
import type { FloorGeometry } from '../scene-model'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import { rectOf, type Rect } from '../themes/lot-math'
import type { TownRoad } from './town-roads'

export const [LONE_FLOOR, PAIR_FLOOR, LARGE_FLOOR] = LIVE_FLOORS.map(([, floor]) => floor)

// The plate with its east edge moved by `metres`, as a desk column or a company arriving does.
export function widened(floor: FloorGeometry, metres: number): FloorGeometry {
  return { ...floor, x: floor.x + metres / 2, width: floor.width + metres }
}

export function edges(rect: Rect): { west: number; east: number; north: number; south: number } {
  const { minX, maxX, minZ, maxZ } = boundsOfZone(rect)
  return { west: minX, east: maxX, north: minZ, south: maxZ }
}

export function fromEdges(edge: ReturnType<typeof edges>): Rect {
  return rectOf(edge.west, edge.east, edge.north, edge.south)
}

// The town's extent at full detail, by hand: three old-town blocks west and a 48 m ring.
export function fullExtent(claim: Rect): Rect {
  const edge = edges(claim)
  return fromEdges({
    west: edge.west - 72,
    east: edge.east + 48,
    north: edge.north - 48,
    south: edge.south + 48
  })
}

// Written out again here on purpose: the plan's rules are checked against their own arithmetic.
export function gap(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2)
  const dz = Math.max(0, Math.abs(a.z - b.z) - (a.depth + b.depth) / 2)
  return Math.hypot(dx, dz)
}

export function overlapping(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 - 1e-9 &&
    Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 - 1e-9
  )
}

export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

// The ground a road covers: its centre line as wide as the road.
export function roadStrip(road: TownRoad): Rect {
  const isAlongX = road.from.z === road.to.z
  return {
    x: (road.from.x + road.to.x) / 2,
    z: (road.from.z + road.to.z) / 2,
    width: isAlongX ? Math.abs(road.to.x - road.from.x) : road.width,
    depth: isAlongX ? road.width : Math.abs(road.to.z - road.from.z)
  }
}
