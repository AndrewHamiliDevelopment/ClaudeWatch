export interface Point {
  x: number
  z: number
}
export interface NavGrid {
  width: number
  height: number
  cellSize: number
  origin: Point
  blocked: string[]
}

export function findPath(grid: NavGrid, from: Point, to: Point): Point[] {
  const cell = (p: Point) => [
    Math.round((p.x - grid.origin.x) / grid.cellSize),
    Math.round((p.z - grid.origin.z) / grid.cellSize)
  ]
  const [sx, sz] = cell(from),
    [tx, tz] = cell(to)
  const start = `${sx},${sz}`,
    target = `${tx},${tz}`
  const blocked = new Set(grid.blocked)
  const valid = (x: number, z: number) =>
    x >= 0 && z >= 0 && x < grid.width && z < grid.height && !blocked.has(`${x},${z}`)
  if (!valid(sx, sz) || !valid(tx, tz)) return []
  const open = new Set([start]),
    costs = new Map([[start, 0]]),
    previous = new Map<string, string>()
  const heuristic = (key: string) => {
    const [x, z] = key.split(',').map(Number)
    return Math.abs(x - tx) + Math.abs(z - tz)
  }
  while (open.size) {
    const current = [...open].reduce((best, key) =>
      costs.get(key)! + heuristic(key) < costs.get(best)! + heuristic(best) ? key : best
    )
    if (current === target) {
      const keys = [current]
      while (previous.has(keys[0])) keys.unshift(previous.get(keys[0])!)
      return keys.map((key) => {
        const [x, z] = key.split(',').map(Number)
        return { x: grid.origin.x + x * grid.cellSize, z: grid.origin.z + z * grid.cellSize }
      })
    }
    open.delete(current)
    const [x, z] = current.split(',').map(Number)
    for (const [dx, dz] of [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1]
    ]) {
      const next = `${x + dx},${z + dz}`,
        cost = costs.get(current)! + 1
      if (valid(x + dx, z + dz) && cost < (costs.get(next) ?? Infinity)) {
        costs.set(next, cost)
        previous.set(next, current)
        open.add(next)
      }
    }
  }
  return []
}
