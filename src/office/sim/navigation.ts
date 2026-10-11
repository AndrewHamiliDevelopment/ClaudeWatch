import { findPath, type NavGrid, type Point } from './path'

export function officeGrid(): NavGrid {
  const blocked: string[] = []
  for (let x = 0; x <= 192; x++)
    for (let z = 0; z <= 54; z++) {
      const corridor = z > 24 && z < 30
      const door = x % 24 === 12 && (z === 24 || z === 30)
      if (!corridor && !door && (x % 24 === 0 || z === 0 || z === 24 || z === 30 || z === 54))
        blocked.push(`${x},${z}`)
    }
  return { width: 193, height: 55, cellSize: 0.25, origin: { x: 0, z: -6.75 }, blocked }
}

export class PathCache {
  private readonly grid = officeGrid()
  private readonly paths = new Map<string, Point[]>()
  get(from: Point, to: Point): Point[] {
    const key = `${from.x},${from.z}:${to.x},${to.z}`
    let path = this.paths.get(key)
    if (!path) {
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
