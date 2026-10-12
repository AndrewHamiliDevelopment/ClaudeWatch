import type { Point } from './path'
import type { ZoneLayout } from './rooms'

// The clear strip between any two zones, and the width of the street the gate stands in.
export const LANE = 3

interface Size {
  width: number
  depth: number
}

// The strip between a company's own wall and what stands inside it.
const VERGE = LANE / 2
// Three four-column projects and the lanes between them.
const SHELF_WIDTH = 69

export interface Grounds extends Size {
  // One top-left corner per box, measured from the company's own top-left corner.
  corners: Point[]
}

function nextBay(occupied: Iterable<number>): number {
  const used = new Set(occupied)
  let bay = 0
  while (used.has(bay)) bay++
  return bay
}

// Lounge seats come in rows of four, one row at least.
export function reserveCapacity(count: number): number {
  return Math.max(4, Math.ceil(count / 4) * 4)
}

// A session keeps the bay it holds and a newcomer takes the lowest free one. A session moves
// down only from past the desks its project still needs (one column each up to four, then
// whole rows), so a move always closes a row or a column and takes a departure.
export function assignBays(
  sessionKeys: string[],
  held: ReadonlyMap<string, number>
): Map<string, number> {
  const count = sessionKeys.length
  const capacity = count <= 4 ? count : Math.ceil(count / 4) * 4
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

// Boxes go left to right along a shelf and start a new shelf below when the next one will not
// fit. A box's corner depends only on the boxes before it, so a later arrival never moves it.
export function packGrounds(boxes: Size[]): Grounds {
  const corners: Point[] = []
  let left = VERGE
  let top = VERGE
  let shelfDepth = 0
  let width = 0
  for (const box of boxes) {
    if (left > VERGE && left + box.width > VERGE + SHELF_WIDTH) {
      top += shelfDepth + LANE
      left = VERGE
      shelfDepth = 0
    }
    corners.push({ x: left, z: top })
    shelfDepth = Math.max(shelfDepth, box.depth)
    width = Math.max(width, left + box.width + VERGE)
    left += box.width + LANE
  }
  return { width, depth: top + shelfDepth + VERGE, corners }
}

// One row of companies on each side of the street. A row starts beside the gate and runs east,
// so a company that grows moves only the ones after it in its own row. A company keeps its side
// and its place in the row (its index); a new one joins the narrower row.
export function packCompanies(companies: ZoneLayout[]): void {
  const row = (side: number): ZoneLayout[] =>
    companies
      .filter((company) => company.index >= 0 && company.index % 2 === side)
      .sort((a, b) => a.index - b.index)
  const span = (members: ZoneLayout[]): number =>
    members.reduce((total, company) => total + company.width + LANE, -LANE)
  // Widest first, so the rows come out even when several companies are placed at once.
  const newcomers = companies
    .filter((candidate) => candidate.index < 0)
    .sort((a, b) => b.width - a.width || a.id.localeCompare(b.id))
  for (const company of newcomers) {
    const side = span(row(0)) <= span(row(1)) ? 0 : 1
    const taken = new Set(row(side).map((member) => member.index))
    let index = side
    while (taken.has(index)) index += 2
    company.index = index
  }
  for (const side of [0, 1]) {
    // Just east of the gate: the lift stands clear of the first company's gateway, 3 m along.
    let left = LANE / 2
    for (const company of row(side)) {
      company.x = left + company.width / 2
      company.z = (side === 0 ? 1 : -1) * (LANE / 2 + company.depth / 2)
      left += company.width + LANE
    }
  }
}
