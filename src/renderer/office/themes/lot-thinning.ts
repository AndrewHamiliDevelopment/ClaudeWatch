import { contains, type Rect } from './lot-math'
import { capped, type Lot } from './surroundings'

// A lighter detail level draws a share of the buildings beyond the plate. They go by seed like
// the cap's, so no side empties and a lot kept at one share is kept at every higher one.
export function thinnedLots(lots: readonly Lot[], ringShare: number, plate: Rect): Lot[] {
  const ringCount = lots.filter((lot) => !contains(plate, lot)).length
  const dropped = ringCount - Math.round(ringCount * ringShare)
  return capped(lots, lots.length - dropped, plate)
}
