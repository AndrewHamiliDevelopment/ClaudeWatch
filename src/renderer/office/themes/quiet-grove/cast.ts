import { GROVE_NEWCOMERS } from './cast-newcomers'
import { HELPER, KEEPER, type GroveCharacter } from './kin'
import { GROVE } from './palette'

// The founding cast: five keepers, five helpers, then one sprout each.
const FOUNDERS: readonly GroveCharacter[] = [
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

// The order local renames are stored in: never reorder, only append.
export const GROVE_CAST: readonly GroveCharacter[] = [...FOUNDERS, ...GROVE_NEWCOMERS]
