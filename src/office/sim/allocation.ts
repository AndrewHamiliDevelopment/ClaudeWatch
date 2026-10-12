import type { Point } from './path'
import type { ZoneLayout } from './rooms'

// The clear strip between any two zones, and the width of the street the gate stands in.
export const LANE = 3

interface Size {
  width: number
  depth: number
}

export interface Grounds extends Size {
  // Top-left corners, measured from the company's own top-left corner.
  projects: Point[]
  lounge: Point
}

function nextBay(occupied: Iterable<number>): number {
  const used = new Set(occupied)
  let bay = 0
  while (used.has(bay)) bay++
  return bay
}

// Desks and lounge seats both come in rows of four.
export function reserveCapacity(count: number): number {
  return Math.max(4, Math.ceil(count / 4) * 4)
}

// A session keeps the bay it holds and a newcomer takes the lowest free one. A session moves
// down only from past the last row its project still needs, which takes a departure.
export function assignBays(
  sessionKeys: string[],
  held: ReadonlyMap<string, number>
): Map<string, number> {
  const capacity = reserveCapacity(sessionKeys.length)
  const bays = new Map<string, number>()
  const taken = new Set<number>()
  for (const key of sessionKeys) {
    const bay = held.get(key)
    if (bay === undefined || taken.has(bay)) continue
    bays.set(key, bay)
    taken.add(bay)
  }
  for (const key of sessionKeys) {
    const bay = bays.get(key)
    if (bay !== undefined && bay < capacity) continue
    if (bay !== undefined) taken.delete(bay)
    const free = nextBay(taken)
    bays.set(key, free)
    taken.add(free)
  }
  return bays
}

// Two projects to a column, columns left to right, so a new project never moves an older one.
// The lounge goes under a lone last project when that does not deepen the grounds, else beside.
export function packGrounds(projects: Size[], lounge: Size): Grounds {
  const corners: Point[] = []
  let left = LANE
  let deepest = 0
  let lastLeft = LANE
  let lastDepth = 0
  for (let first = 0; first < projects.length; first += 2) {
    const column = projects.slice(first, first + 2)
    let top = LANE
    for (const project of column) {
      corners.push({ x: left, z: top })
      top += project.depth + LANE
    }
    lastLeft = left
    lastDepth = top - 2 * LANE
    deepest = Math.max(deepest, lastDepth)
    left += Math.max(...column.map((project) => project.width)) + LANE
  }
  const under = lastDepth + LANE + lounge.depth
  if (projects.length % 2 === 1 && under <= deepest) {
    return {
      width: left,
      depth: deepest + 2 * LANE,
      projects: corners,
      lounge: { x: lastLeft, z: LANE + lastDepth + LANE }
    }
  }
  return {
    width: left + lounge.width + LANE,
    depth: Math.max(deepest, lounge.depth) + 2 * LANE,
    projects: corners,
    lounge: { x: left, z: LANE }
  }
}

// One row of companies on each side of the street, each row centred on the gate. A company keeps
// its side and its place in the row (its index); a new one joins the narrower row.
export function packCompanies(companies: ZoneLayout[]): void {
  const row = (side: number): ZoneLayout[] =>
    companies
      .filter((company) => company.index >= 0 && company.index % 2 === side)
      .sort((a, b) => a.index - b.index)
  const span = (members: ZoneLayout[]): number =>
    members.reduce((total, company) => total + company.width + LANE, -LANE)
  for (const company of companies.filter((candidate) => candidate.index < 0)) {
    const side = span(row(0)) <= span(row(1)) ? 0 : 1
    const taken = new Set(row(side).map((member) => member.index))
    let index = side
    while (taken.has(index)) index += 2
    company.index = index
  }
  for (const side of [0, 1]) {
    const members = row(side)
    let left = -span(members) / 2
    for (const company of members) {
      company.x = left + company.width / 2
      company.z = (side === 0 ? 1 : -1) * (LANE / 2 + company.depth / 2)
      left += company.width + LANE
    }
  }
}
