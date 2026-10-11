import type { RosterEntry } from '../types'
import { GARRISON } from './palette'

type Section = 'wing' | 'deck'
export type CrewFeature =
  | 'peaked-cap'
  | 'greatcoat'
  | 'shoulder-boards'
  | 'flight-helmet'
  | 'hard-hat'
  | 'headset'
  | 'ear-defenders'
  | 'antenna'
  | 'goggles'
  | 'respirator'
  | 'braid'
  | 'scarf'
  | 'bandolier'
  | 'hi-vis-bands'
  | 'tool-pack'
  | 'tank-pack'
  | 'tablet'
  | 'wands'

export interface GarrisonCharacter extends RosterEntry {
  section: Section
  isSquad: boolean
  suit: string
  trim: string
  headgear: string
  hair: string
  skin: string
  features: readonly CrewFeature[]
}

// Claude sessions fly: white flight suits. Codex sessions keep the deck: orange coveralls.
const WING = {
  section: 'wing',
  isSquad: false,
  suit: GARRISON.white,
  trim: GARRISON.orange,
  headgear: GARRISON.white,
  skin: GARRISON.skin
} as const
const DECK = {
  section: 'deck',
  isSquad: false,
  suit: GARRISON.orange,
  trim: GARRISON.white,
  headgear: GARRISON.white,
  skin: GARRISON.skin
} as const

// Original characters. A session's office bay picks its lead, in this order.
export const WING_LEADS: readonly GarrisonCharacter[] = [
  {
    ...WING,
    id: 'idris-calloway',
    name: 'Idris Calloway',
    role: 'Garrison commander; runs the station from the bridge and signs every sortie.',
    hair: GARRISON.steel,
    skin: GARRISON.umber,
    features: ['peaked-cap', 'greatcoat', 'shoulder-boards']
  },
  {
    ...WING,
    id: 'noor-vasquez',
    name: 'Noor Vasquez',
    role: 'Flight lead; takes the line trooper frame out first and brings the wing home.',
    hair: GARRISON.hull,
    features: ['flight-helmet']
  },
  {
    ...WING,
    id: 'bram-okafor',
    name: 'Bram Okafor',
    role: 'Gunner of the heavy artillery frame; patient, loud and never short of rounds.',
    hair: GARRISON.hull,
    skin: GARRISON.umber,
    headgear: GARRISON.navy,
    features: ['ear-defenders', 'bandolier']
  },
  {
    ...WING,
    id: 'suvi-lindqvist',
    name: 'Suvi Lindqvist',
    role: 'Scout pilot; flies the fast frame ahead of the wing and reports what is out there.',
    hair: GARRISON.white,
    features: ['headset', 'antenna', 'scarf']
  },
  {
    ...WING,
    id: 'dara-whitlock',
    name: 'Dara Whitlock',
    role: 'Flight controller; plots every approach and talks the pilots back onto the deck.',
    hair: GARRISON.orange,
    features: ['braid', 'goggles', 'tablet']
  }
]

export const DECK_LEADS: readonly GarrisonCharacter[] = [
  {
    ...DECK,
    id: 'hollis-varga',
    name: 'Hollis Varga',
    role: 'Deck chief; nothing launches from the hangar until the chief has checked it.',
    hair: GARRISON.steel,
    features: ['hard-hat', 'hi-vis-bands', 'tablet']
  },
  {
    ...DECK,
    id: 'pim-arkwright',
    name: 'Pim Arkwright',
    role: 'Frame mechanic; rebuilds a knee actuator between two sorties and hums while at it.',
    hair: GARRISON.umber,
    features: ['goggles', 'tool-pack']
  },
  {
    ...DECK,
    id: 'odalys-ferro',
    name: 'Odalys Ferro',
    role: 'Ordnance loader; arms the artillery frame and counts every shell back in.',
    hair: GARRISON.hull,
    skin: GARRISON.umber,
    features: ['ear-defenders', 'bandolier']
  },
  {
    ...DECK,
    id: 'tavi-renko',
    name: 'Tavi Renko',
    role: 'Signal officer; waves the frames out of their gantries with a pair of lit wands.',
    hair: GARRISON.hull,
    features: ['headset', 'hi-vis-bands', 'wands']
  },
  {
    ...DECK,
    id: 'josune-abara',
    name: 'Josune Abara',
    role: 'Reactor technician; keeps the frames fuelled and the coolant where it belongs.',
    hair: GARRISON.white,
    features: ['respirator', 'tank-pack', 'braid']
  }
]

// Subagents: one squad member per section, in plain steel headgear.
export const WING_CADET: GarrisonCharacter = {
  ...WING,
  isSquad: true,
  id: 'wing-cadet',
  name: 'Wing Cadet',
  role: 'Squad member of the flight wing; flies a delegated task for a pilot.',
  headgear: GARRISON.steel,
  hair: GARRISON.hull,
  features: ['flight-helmet']
}
export const DECKHAND: GarrisonCharacter = {
  ...DECK,
  isSquad: true,
  id: 'deckhand',
  name: 'Deckhand',
  role: 'Squad member of the deck crew; runs a delegated task for a crew lead.',
  headgear: GARRISON.steel,
  hair: GARRISON.hull,
  features: ['hard-hat']
}

// The order local renames are stored in: never reorder, only append.
export const GARRISON_CAST: readonly GarrisonCharacter[] = [
  ...WING_LEADS,
  ...DECK_LEADS,
  WING_CADET,
  DECKHAND
]
