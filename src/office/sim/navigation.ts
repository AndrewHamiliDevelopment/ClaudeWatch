import { findPath, type NavGrid, type Point } from './path'
import type { FloorLayout, ZoneLayout } from './layout'

export function officeGrid(floor: FloorLayout): NavGrid {
  const cellSize = 0.25
  const origin = { x: -floor.width / 2, z: -floor.depth / 2 }
  const blocked = new Set<string>()
  const wall = (zone: ZoneLayout) => {
    const left = zone.x - zone.width / 2,
      top = zone.z - zone.depth / 2
    const add = (x: number, z: number) => {
      if (z === zone.door.z && Math.abs(x - zone.door.x) <= 0.5) return
      blocked.add(
        `${Math.round((x - origin.x) / cellSize)},${Math.round((z - origin.z) / cellSize)}`
      )
    }
    for (let x = left; x <= left + zone.width; x += cellSize) {
      add(x, top)
      add(x, top + zone.depth)
    }
    for (let z = top; z <= top + zone.depth; z += cellSize) {
      add(left, z)
      add(left + zone.width, z)
    }
    for (const child of zone.children) wall(child)
  }
  for (const company of floor.zones) wall(company)
  return {
    width: Math.round(floor.width / cellSize) + 1,
    height: Math.round(floor.depth / cellSize) + 1,
    cellSize,
    origin,
    blocked: [...blocked]
  }
}

export class PathCache {
  private readonly paths = new Map<string, Point[]>()
  private grid: NavGrid | null = null
  constructor(private readonly floor: FloorLayout) {}
  get(from: Point, to: Point): Point[] {
    const key = `${from.x},${from.z}:${to.x},${to.z}`
    let path = this.paths.get(key)
    if (!path) {
      // Built on first use: most feed messages only change activity and need no path.
      this.grid ??= officeGrid(this.floor)
      path = findPath(this.grid, from, to)
      this.paths.set(key, path)
    }
    return path.map((p) => ({ ...p }))
  }
  via(from: Point, door: Point, to: Point): Point[] {
    const first = this.get(from, door),
      second = this.get(door, to)
    return first.length && second.length ? [...first, ...second.slice(1)] : []
  }
}
