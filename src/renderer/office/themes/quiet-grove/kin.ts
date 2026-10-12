import type { RosterEntry } from '../types'
import { GROVE } from './palette'

export type Kin = 'keeper' | 'helper' | 'wanderer'
// Drawn at one place on one kin, or on the head, which every kin carries at the same height.
export type SpiritFeature =
  | 'straw-hat'
  | 'leaf-crown'
  | 'top-knot'
  | 'pine-hood'
  | 'bark-cap'
  | 'reed-tuft'
  | 'cap-shade'
  | 'lily-pad'
  | 'twin-leaves'
  | 'pebble-crest'
  | 'lantern-staff'
  | 'log-pack'
  | 'scroll'
  | 'satchel'
  | 'broom'
  | 'pail'
  | 'shovel'
  | 'scarf-tail'
  | 'back-lantern'
  | 'wide-brim'
  | 'kerchief'
  | 'antler-twigs'
  | 'mushroom-cap'
  | 'shell-cap'
  | 'acorn-cap'
// Carried on the back, placed by the shoulder height of whichever kin carries it.
export type CarriedFeature =
  | 'walking-staff'
  | 'frame-pack'
  | 'basket'
  | 'yoke'
  | 'reed-bundle'
  | 'kite'
  | 'bell'
  | 'ladder'
  | 'torch'
  | 'net'
  | 'seed-sack'

export interface GroveCharacter extends RosterEntry {
  kin: Kin
  isSprout: boolean
  // Robe for a keeper, hide for a helper, cape for a wanderer, pot for a sprout.
  body: string
  trim: string
  features: readonly (SpiritFeature | CarriedFeature)[]
}

// Claude sessions are the tall, warm keepers of the clearing; Codex sessions the small, cool
// helpers from the stream; OpenCode sessions the leaf-headed wanderers off the trail.
export const KEEPER = {
  kin: 'keeper',
  isSprout: false,
  body: GROVE.clay,
  trim: GROVE.paper
} as const
export const HELPER = {
  kin: 'helper',
  isSprout: false,
  body: GROVE.stone,
  trim: GROVE.pond
} as const
export const WANDERER = {
  kin: 'wanderer',
  isSprout: false,
  body: GROVE.moss,
  trim: GROVE.timber
} as const

// The other trim colours an agent of a kin may wear instead of its character's own.
export const KIN_ACCENTS: Record<Kin, readonly string[]> = {
  keeper: [GROVE.fern, GROVE.pond],
  helper: [GROVE.fern, GROVE.paper],
  wanderer: [GROVE.paper, GROVE.clay]
}
