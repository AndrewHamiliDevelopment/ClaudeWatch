import type { RosterEntry } from '../types'
import { GARRISON } from './palette'

export type Section = 'wing' | 'deck' | 'signal'
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
  | 'beret'
  | 'visor-cap'
  | 'side-cap'
  | 'hood'
  | 'weld-mask'
  | 'chart-tube'
  | 'medic-bag'
  | 'jet-pack'
  | 'cable-coil'
  | 'crate'
  | 'extinguisher'
  | 'dish-pack'
  | 'tripod'
  | 'signal-flag'

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
// OpenCode sessions keep the signals: navy watch suits.
export const WING = {
  section: 'wing',
  isSquad: false,
  suit: GARRISON.white,
  trim: GARRISON.orange,
  headgear: GARRISON.white,
  skin: GARRISON.skin
} as const
export const DECK = {
  section: 'deck',
  isSquad: false,
  suit: GARRISON.orange,
  trim: GARRISON.white,
  headgear: GARRISON.white,
  skin: GARRISON.skin
} as const
export const SIGNAL = {
  section: 'signal',
  isSquad: false,
  suit: GARRISON.navy,
  trim: GARRISON.steel,
  headgear: GARRISON.steel,
  skin: GARRISON.skin
} as const

// The other trim colours an agent of a section may wear instead of its character's own.
export const SECTION_ACCENTS: Record<Section, readonly string[]> = {
  wing: [GARRISON.navy, GARRISON.ice],
  deck: [GARRISON.navy, GARRISON.steel],
  signal: [GARRISON.ice, GARRISON.orange]
}
