import type { FloorGeometry } from '../scene-model'
import { Parts, type PartSpec } from './parts'
import { GROUND_Y, type Lot } from './surroundings'

// A lot as a design sees it: centred on its own origin, standing on y 0, free up to `height`.
export interface Plot {
  width: number
  depth: number
  height: number
  seed: number
}

export interface LotDesign {
  name: string
  // The lowest plot this design still reads on; taller plots let it grow.
  minHeight: number
  parts: (plot: Plot) => PartSpec[]
}

export interface DesignSet {
  buildings: readonly LotDesign[]
  props: readonly LotDesign[]
}

// Props are drawn for a spot this size and shrunk to fit a lower one.
export const PROP_PLOT = { length: 1, reach: 0.8, height: 1.6 }
const PAIRED_PROP_LENGTH_M = 1.6

// The nth value in [0, 1) from a lot's seed: the same world on every start.
export function seeded(seed: number, nth: number): number {
  let mixed = (seed ^ Math.imul(nth + 1, 0x9e3779b9)) | 0
  mixed = Math.imul(mixed ^ (mixed >>> 16), 0x85ebca6b)
  mixed = Math.imul(mixed ^ (mixed >>> 13), 0xc2b2ae35)
  return ((mixed ^ (mixed >>> 16)) >>> 0) / 0x100000000
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

// A lot on the plate stands on the slab; every other lot stands on the ground.
export function lotBase(lot: Lot, floor: Pick<FloorGeometry, 'width' | 'depth'>): number {
  const isOnPlate =
    Math.abs(lot.x) + lot.width / 2 <= floor.width / 2 &&
    Math.abs(lot.z) + lot.depth / 2 <= floor.depth / 2
  return isOnPlate ? 0 : GROUND_Y
}

export function plotOf(lot: Lot, baseY: number): Plot {
  return { width: lot.width, depth: lot.depth, height: lot.maxHeight - baseY, seed: lot.seed }
}

// The tallest-fitting designs are all candidates, so a tall lot is not always a tower.
export function designFor(designs: readonly LotDesign[], plot: Plot, nth = 0): LotDesign {
  const fitting = designs.filter((design) => design.minHeight <= plot.height)
  const options = fitting.length > 0 ? fitting : [lowest(designs)]
  return options[Math.floor(seeded(plot.seed, 40 + nth) * options.length)]
}

function lowest(designs: readonly LotDesign[]): LotDesign {
  return designs.reduce((least, design) => (design.minHeight < least.minHeight ? design : least))
}

export interface PlacedParts {
  key: string
  at: [number, number, number]
  rotationY: number
  scale: number
  parts: PartSpec[]
}

function propsOn(lot: Lot, baseY: number, designs: readonly LotDesign[]): PlacedParts[] {
  const plot = plotOf(lot, baseY)
  const isAlongX = lot.width >= lot.depth
  const length = isAlongX ? lot.width : lot.depth
  const scale = Math.min(1, plot.height / PROP_PLOT.height)
  const offsets = length >= PAIRED_PROP_LENGTH_M ? [-length / 4, length / 4] : [0]
  return offsets.map((offset, nth) => ({
    key: `${lot.id}:${nth}`,
    at: [lot.x + (isAlongX ? offset : 0), baseY, lot.z + (isAlongX ? 0 : offset)],
    rotationY: isAlongX ? 0 : Math.PI / 2,
    scale,
    parts: designFor(designs, { ...plot, height: PROP_PLOT.height }, nth).parts({
      ...plot,
      width: PROP_PLOT.length,
      depth: PROP_PLOT.reach,
      height: PROP_PLOT.height,
      seed: plot.seed + nth
    })
  }))
}

// What stands on a lot, picked from its seed alone.
export function lotContents(lot: Lot, baseY: number, set: DesignSet): PlacedParts[] {
  if (lot.kind === 'prop') return propsOn(lot, baseY, set.props)
  const plot = plotOf(lot, baseY)
  return [
    {
      key: lot.id,
      at: [lot.x, baseY, lot.z],
      rotationY: 0,
      scale: 1,
      parts: designFor(set.buildings, plot).parts(plot)
    }
  ]
}

export function LotParts({
  lots,
  set,
  baseOf
}: {
  lots: readonly Lot[]
  set: DesignSet
  baseOf: (lot: Lot) => number
}) {
  return (
    <>
      {lots
        .flatMap((lot) => lotContents(lot, baseOf(lot), set))
        .map((placed) => (
          <group
            key={placed.key}
            position={placed.at}
            rotation={[0, placed.rotationY, 0]}
            scale={placed.scale}
          >
            <Parts parts={placed.parts} />
          </group>
        ))}
    </>
  )
}
