import type { Rect } from './lot-math'
import type { PartSpec } from './parts'
import type { Vector } from './primitives'
import { draw, lotBase, type Lot } from './surroundings'

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

// The lot's own seed draws 0 to 3 are spent on its size and place.
const DRAW = { design: 4, height: 5, turn: 6 }
const FOOTPRINT_SHARE = 0.92
// A lot picks among the tallest designs it has room for, so height follows the room there is.
const TALLEST_CHOICES = 4
const PROP_SCALE = { min: 0.6, max: 1.4 }

// At most `limit` of the items, taken evenly so no part of the floor is left out.
export function spread<Item>(items: readonly Item[], limit: number): Item[] {
  const stride = Math.max(1, Math.ceil(items.length / limit))
  return items.filter((_, index) => index % stride === 0)
}

function pick<Design>(choices: readonly Design[], seed: number): Design {
  return choices[Math.floor(draw(seed, DRAW.design) * choices.length)]
}

function placeBuilding(lot: Lot, room: number, kit: LotKit): Omit<PlacedLot, 'lot' | 'at' | 'key'> {
  const byHeight = [...kit.buildings].sort((a, b) => a.height.max - b.height.max)
  const fitting = byHeight.filter((design) => design.height.min <= room)
  const design = fitting.length > 0 ? pick(fitting.slice(-TALLEST_CHOICES), lot.seed) : byHeight[0]
  const { min, max } = design.height
  const height = Math.min(room, min + (max - min) * draw(lot.seed, DRAW.height))
  return {
    design: design.name,
    turn: draw(lot.seed, DRAW.turn) < 0.5 ? 0 : Math.PI,
    scale: 1,
    parts: design.build({
      width: lot.width * FOOTPRINT_SHARE,
      depth: lot.depth * FOOTPRINT_SHARE,
      height,
      seed: lot.seed
    })
  }
}

function placeProp(lot: Lot, room: number, kit: LotKit): Omit<PlacedLot, 'lot' | 'at' | 'key'> {
  const byHeight = [...kit.props].sort((a, b) => a.size[1] - b.size[1])
  const fitting = byHeight.filter((design) => room / design.size[1] >= PROP_SCALE.min)
  const design = fitting.length > 0 ? pick(fitting, lot.seed) : byHeight[0]
  const isAlongX = lot.width >= lot.depth
  const [length, height, reach] = design.size
  return {
    design: design.name,
    turn: isAlongX ? 0 : Math.PI / 2,
    scale: Math.min(
      PROP_SCALE.max,
      room / height,
      (isAlongX ? lot.width : lot.depth) / length,
      (isAlongX ? lot.depth : lot.width) / reach
    ),
    parts: design.parts
  }
}

// What stands on a lot: chosen from its seed alone, sized to its footprint and height limit.
export function placeLot(lot: Lot, plate: Rect, kit: LotKit): PlacedLot {
  const base = lotBase(lot, plate)
  const room = lot.maxHeight - base
  const placed = lot.kind === 'prop' ? placeProp(lot, room, kit) : placeBuilding(lot, room, kit)
  return { lot, key: lot.id, at: [lot.x, base, lot.z], ...placed }
}
