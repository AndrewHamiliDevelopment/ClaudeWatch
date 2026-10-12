import type { Plot } from './lot-kit'
import type { PartSpec } from './parts'

export interface LotDesign {
  name: string
  // The lowest plot this design still reads on; taller plots let it grow.
  minHeight: number
  parts: (plot: Plot) => PartSpec[]
}
