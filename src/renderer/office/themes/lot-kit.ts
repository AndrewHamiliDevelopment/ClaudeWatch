import type { PartSpec } from './parts'
import type { Vector } from './primitives'
import type { Lot } from './surroundings'

// The ground a design is built on: x and z centred on the lot, y up from 0 to `height`.
export interface Plot {
  width: number
  depth: number
  height: number
  seed: number
}

export interface BuildingDesign {
  name: string
  // The heights it looks right at; it is never chosen for a lot lower than `min`.
  height: { min: number; max: number }
  build: (plot: Plot) => PartSpec[]
}

export interface PropDesign {
  name: string
  // Its natural length (x), height and reach (z); the whole prop is scaled to fit its lot.
  size: Vector
  parts: readonly PartSpec[]
}

export interface LotKit {
  buildings: readonly BuildingDesign[]
  props: readonly PropDesign[]
}

// Parts round their own origin, and where on the floor that origin goes.
export interface PlacedGroup {
  key: string
  at: Vector
  turn: number
  scale: number
  parts: readonly PartSpec[]
}

export interface PlacedLot extends PlacedGroup {
  lot: Lot
  design: string
}

// At most `limit` of the items, taken evenly so no part of the floor is left out.
export function spread<Item>(items: readonly Item[], limit: number): Item[] {
  const stride = Math.max(1, Math.ceil(items.length / limit))
  return items.filter((_, index) => index % stride === 0)
}
