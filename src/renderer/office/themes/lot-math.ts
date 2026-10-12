export interface Rect {
  x: number
  z: number
  width: number
  depth: number
}

export interface Span {
  min: number
  max: number
}

export function rectOf(west: number, east: number, north: number, south: number): Rect {
  return { x: (west + east) / 2, z: (north + south) / 2, width: east - west, depth: south - north }
}

export function gapBetween(a: Rect, b: Rect): number {
  const dx = Math.max(0, Math.abs(a.x - b.x) - (a.width + b.width) / 2)
  const dz = Math.max(0, Math.abs(a.z - b.z) - (a.depth + b.depth) / 2)
  return Math.hypot(dx, dz)
}

export function overlaps(a: Rect, b: Rect): boolean {
  return (
    Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.z - b.z) < (a.depth + b.depth) / 2
  )
}

export function contains(outer: Rect, inner: Rect): boolean {
  return (
    Math.abs(inner.x - outer.x) + inner.width / 2 <= outer.width / 2 &&
    Math.abs(inner.z - outer.z) + inner.depth / 2 <= outer.depth / 2
  )
}

export function grow(rect: Rect, metres: number): Rect {
  return { ...rect, width: rect.width + metres * 2, depth: rect.depth + metres * 2 }
}

// FNV-1a: the same text gives the same number on every machine and every start.
export function hashOf(text: string): number {
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

// The nth value in [0, 1) drawn from a seed.
export function draw(seed: number, nth: number): number {
  let mixed = (seed + Math.imul(nth + 1, 0x9e3779b9)) | 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b)
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35)
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 0x100000000
}

export const between = (range: Span, share: number): number =>
  range.min + (range.max - range.min) * share
