import type { PlacedGroup, Plot } from './lot-kit'
import type { PartSpec } from './parts'
import { draw, type Lot } from './surroundings'

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

export function plotOf(lot: Lot, baseY: number): Plot {
  return { width: lot.width, depth: lot.depth, height: lot.maxHeight - baseY, seed: lot.seed }
}

// The tallest-fitting designs are all candidates, so a tall lot is not always a tower.
export function designFor(designs: readonly LotDesign[], plot: Plot, nth = 0): LotDesign {
  const fitting = designs.filter((design) => design.minHeight <= plot.height)
  const options = fitting.length > 0 ? fitting : [lowest(designs)]
  return options[Math.floor(draw(plot.seed, 40 + nth) * options.length)]
}

function lowest(designs: readonly LotDesign[]): LotDesign {
  return designs.reduce((least, design) => (design.minHeight < least.minHeight ? design : least))
}

function propsOn(lot: Lot, baseY: number, designs: readonly LotDesign[]): PlacedGroup[] {
  const plot = plotOf(lot, baseY)
  const isAlongX = lot.width >= lot.depth
  const length = isAlongX ? lot.width : lot.depth
  const scale = Math.min(1, plot.height / PROP_PLOT.height)
  const offsets = length >= PAIRED_PROP_LENGTH_M ? [-length / 4, length / 4] : [0]
  return offsets.map((offset, nth) => ({
    key: `${lot.id}:${nth}`,
    at: [lot.x + (isAlongX ? offset : 0), baseY, lot.z + (isAlongX ? 0 : offset)],
    turn: isAlongX ? 0 : Math.PI / 2,
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
export function lotContents(lot: Lot, baseY: number, set: DesignSet): PlacedGroup[] {
  if (lot.kind === 'prop') return propsOn(lot, baseY, set.props)
  const plot = plotOf(lot, baseY)
  return [
    {
      key: lot.id,
      at: [lot.x, baseY, lot.z],
      turn: 0,
      scale: 1,
      parts: designFor(set.buildings, plot).parts(plot)
    }
  ]
}
