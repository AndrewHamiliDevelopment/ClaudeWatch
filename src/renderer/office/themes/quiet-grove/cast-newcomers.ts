import { HELPER, KEEPER, WANDERER, type GroveCharacter } from './kin'
import { GROVE } from './palette'

// Original characters, appended after the founding cast: three more keepers, three more
// helpers, then the wanderers and their seedling.
export const GROVE_NEWCOMERS: readonly GroveCharacter[] = [
  {
    ...KEEPER,
    id: 'rowan-thatch',
    name: 'Rowan Thatch',
    role: 'Thatcher; climbs up after every storm and lays the roof straight again.',
    features: ['wide-brim', 'ladder']
  },
  {
    ...KEEPER,
    id: 'hazel-kindle',
    name: 'Hazel Kindle',
    role: 'Water carrier; brings two full pails up from the spring before the kettle is on.',
    body: GROVE.timber,
    trim: GROVE.fern,
    features: ['kerchief', 'yoke']
  },
  {
    ...KEEPER,
    id: 'yarrow-fell',
    name: 'Yarrow Fell',
    role: 'Bell ringer; sounds the hour so nobody in the grove works past supper.',
    body: GROVE.timber,
    features: ['antler-twigs', 'bell']
  },
  {
    ...HELPER,
    id: 'mica-shoal',
    name: 'Mica Shoal',
    role: 'Net mender; skims fallen leaves off the pond before they sink.',
    features: ['shell-cap', 'net']
  },
  {
    ...HELPER,
    id: 'burr-thicket',
    name: 'Burr Thicket',
    role: 'Seed carrier; hauls a sack twice its own size and never spills one.',
    trim: GROVE.fern,
    features: ['acorn-cap', 'seed-sack']
  },
  {
    ...HELPER,
    id: 'silt-eddy',
    name: 'Silt Eddy',
    role: 'Reed cutter; brings in the bundles the weavers ask for, always one extra.',
    features: ['wide-brim', 'reed-bundle']
  },
  {
    ...WANDERER,
    id: 'juniper-vale',
    name: 'Juniper Vale',
    role: 'Wayfinder; has walked every trail into the grove and marks the safe ones.',
    features: ['wide-brim', 'walking-staff']
  },
  {
    ...WANDERER,
    id: 'thistle-roam',
    name: 'Thistle Roam',
    role: 'Pedlar; carries a whole shop on a pack frame and trades for stories.',
    body: GROVE.pine,
    features: ['kerchief', 'frame-pack']
  },
  {
    ...WANDERER,
    id: 'sedge-harrow',
    name: 'Sedge Harrow',
    role: 'Forager; knows which mushroom is supper and which is a mistake.',
    features: ['mushroom-cap', 'basket']
  },
  {
    ...WANDERER,
    id: 'larch-ember',
    name: 'Larch Ember',
    role: 'Fire carrier; brings a lit torch from the last camp to light the next one.',
    features: ['pine-hood', 'torch']
  },
  {
    ...WANDERER,
    id: 'clover-drift',
    name: 'Clover Drift',
    role: 'Wind reader; flies a paper kite to tell the grove what weather is coming.',
    trim: GROVE.paper,
    features: ['twin-leaves', 'kite']
  },
  {
    ...WANDERER,
    id: 'bramble-knoll',
    name: 'Bramble Knoll',
    role: 'Berry picker; comes back with both pails full and a purple grin.',
    body: GROVE.pine,
    features: ['leaf-crown', 'yoke']
  },
  {
    ...WANDERER,
    id: 'osier-wend',
    name: 'Osier Wend',
    role: 'Weaver; turns a bundle of reeds into a basket while walking.',
    features: ['top-knot', 'reed-bundle']
  },
  {
    ...WANDERER,
    id: 'teasel-hark',
    name: 'Teasel Hark',
    role: 'Storyteller; rings a small bell when a tale is about to begin.',
    body: GROVE.pine,
    trim: GROVE.paper,
    features: ['antler-twigs', 'bell']
  },
  {
    ...WANDERER,
    isSprout: true,
    id: 'trail-seedling',
    name: 'Trail Seedling',
    role: 'A seedling in a wooden pot beside its wanderer; runs one delegated task.',
    body: GROVE.timber,
    features: []
  }
]
