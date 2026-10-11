import type { RosterEntry } from '../violet-court/cast'
import { GROVE } from './palette'

type Kin = 'keeper' | 'helper'
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

export interface GroveCharacter extends RosterEntry {
  kin: Kin
  isSprout: boolean
  // Robe for a keeper, hide for a helper, pot for a sprout.
  body: string
  trim: string
  features: readonly SpiritFeature[]
}

const KEEPER = { kin: 'keeper', isSprout: false, body: GROVE.clay, trim: GROVE.paper } as const
const HELPER = { kin: 'helper', isSprout: false, body: GROVE.stone, trim: GROVE.pond } as const

// Original characters: Claude sessions are the tall, warm keepers of the clearing; Codex sessions
// the small, cool helpers from the stream. Five leads per kin, then one sprout each; roster.ts
// indexes into this order.
export const GROVE_CAST: readonly GroveCharacter[] = [
  {
    ...KEEPER,
    id: 'tansy-rushlight',
    name: 'Tansy Rushlight',
    role: 'Lamplighter of the clearing; tends every paper lantern so nobody works in the dark.',
    features: ['straw-hat', 'lantern-staff']
  },
  {
    ...KEEPER,
    id: 'bracken-holt',
    name: 'Bracken Holt',
    role: 'Woodwright; planes the desks and mends the decking after rain.',
    body: GROVE.timber,
    features: ['bark-cap', 'log-pack']
  },
  {
    ...KEEPER,
    id: 'linden-quill',
    name: 'Linden Quill',
    role: 'Record keeper; writes each day of the grove into a ledger of bark.',
    trim: GROVE.fern,
    features: ['leaf-crown', 'scroll']
  },
  {
    ...KEEPER,
    id: 'sorrel-wick',
    name: 'Sorrel Wick',
    role: 'Herbalist; brews the tea and knows which leaf settles a restless mind.',
    body: GROVE.timber,
    trim: GROVE.fern,
    features: ['top-knot', 'satchel']
  },
  {
    ...KEEPER,
    id: 'alder-moss',
    name: 'Alder Moss',
    role: 'Path sweeper; keeps the stepping stones clear from the gate to every desk.',
    features: ['pine-hood', 'broom']
  },
  {
    ...HELPER,
    id: 'pebble-brook',
    name: 'Pebble Brook',
    role: 'Stream tender; keeps the water running clear past the studio.',
    features: ['reed-tuft', 'pail']
  },
  {
    ...HELPER,
    id: 'flint-burrow',
    name: 'Flint Burrow',
    role: 'Digger; turns the soil and plants whatever the keepers hand over.',
    features: ['cap-shade', 'shovel']
  },
  {
    ...HELPER,
    id: 'drizzle-fen',
    name: 'Drizzle Fen',
    role: 'Rain catcher; fills the pond and waters every planter on the deck.',
    features: ['lily-pad', 'scarf-tail']
  },
  {
    ...HELPER,
    id: 'cobble-wren',
    name: 'Cobble Wren',
    role: 'Messenger; carries notes between the offices faster than anyone walks.',
    trim: GROVE.fern,
    features: ['twin-leaves', 'scarf-tail']
  },
  {
    ...HELPER,
    id: 'nettle-tarn',
    name: 'Nettle Tarn',
    role: 'Night watch; sits up with a lantern until the last desk goes quiet.',
    features: ['pebble-crest', 'back-lantern']
  },
  {
    ...KEEPER,
    isSprout: true,
    id: 'hearth-sprout',
    name: 'Hearth Sprout',
    role: 'A seedling in a clay pot beside its keeper; runs one delegated task.',
    features: []
  },
  {
    ...HELPER,
    isSprout: true,
    id: 'brook-sapling',
    name: 'Brook Sapling',
    role: 'A seedling in a stone pot beside its helper; runs one delegated task.',
    features: []
  }
]
