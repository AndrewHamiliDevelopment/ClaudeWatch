import type { Bounds, ZoneLayout } from './rooms'

export const RESERVATION_MS = 24 * 60 * 60 * 1000
const COMPANY_CORRIDOR = 3
export const PROJECT_STRIDE_X = 30
export const PROJECT_STRIDE_Z = 42

export function overlaps(a: Bounds, b: Bounds, gap = 0): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 + gap &&
    Math.abs(a.z - b.z) < (a.depth + b.depth) / 2 + gap
  )
}

export function reserveCapacity(count: number, previous = 0): number {
  return Math.max(previous, 4, Math.ceil(count / 4) * 4)
}

export function nextBay(occupied: number[]): number {
  const used = new Set(occupied)
  let bay = 0
  while (used.has(bay)) bay++
  return bay
}

// A fixed two-column grid. A company keeps its cell for good: when one outgrows the pitch the
// cells widen, but nobody changes sides.
export function packCompanies(companies: ZoneLayout[]): void {
  const width = Math.max(63, ...companies.map((c) => c.width))
  const depth = Math.max(87, ...companies.map((c) => c.depth))
  const place = (company: ZoneLayout, index: number): void => {
    const row = Math.floor(index / 2)
    const left = index % 2 === 0 ? 3 : -width - 3
    const top =
      row % 2 === 0
        ? 3 + Math.floor(row / 2) * (depth + 3)
        : -depth - 3 - Math.floor(row / 2) * (depth + 3)
    company.x = left + company.width / 2
    company.z = top + company.depth / 2
    company.index = index
  }
  const placed = companies.filter((c) => c.index !== -1)
  const taken = placed.map((c) => c.index)
  for (const company of companies.filter((c) => c.index === -1)) {
    place(company, nextBay(taken))
    taken.push(company.index)
  }
  const isCrowded = companies.some((a, i) =>
    companies.slice(i + 1).some((b) => overlaps(a, b, COMPANY_CORRIDOR))
  )
  if (isCrowded) for (const company of placed) place(company, company.index)
}
