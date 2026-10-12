import type { RosterEntry } from '../types'
import { COURT } from './palette'

export type Faction = 'order' | 'corps' | 'guild'
export type PilotFeature =
  | 'mask'
  | 'high-collar'
  | 'cloak'
  | 'cape'
  | 'blades'
  | 'banner'
  | 'pack'
  | 'epaulettes'
  | 'long-hair'
  | 'ponytail'
  | 'cap'
  | 'helmet'
  | 'goggles'
  | 'tablet'
  | 'wide-hat'
  | 'plume'
  | 'hood'
  | 'beret'
  | 'bun'
  | 'horn'
  | 'scroll-case'
  | 'tabard'
  | 'shield'
  | 'lantern'
  | 'staff'
  | 'satchel'

export interface CourtCharacter extends RosterEntry {
  faction: Faction
  isSquad: boolean
  jacket: string
  trousers: string
  trim: string
  hair: string
  features: readonly PilotFeature[]
}

// Claude sessions are the Order (dark), Codex sessions the Lance Corps (pale), OpenCode sessions
// the Herald Guild (crimson, and always in a tabard).
export const ORDER = {
  faction: 'order',
  isSquad: false,
  trousers: COURT.ink,
  trim: COURT.violet
} as const
export const CORPS = {
  faction: 'corps',
  isSquad: false,
  trousers: COURT.marble,
  trim: COURT.gold
} as const
export const GUILD = {
  faction: 'guild',
  isSquad: false,
  jacket: COURT.crimson,
  trousers: COURT.slate,
  trim: COURT.marble
} as const

// The other trim colours an agent of a faction may wear instead of its character's own.
export const FACTION_ACCENTS: Record<Faction, readonly string[]> = {
  order: [COURT.gold, COURT.marble],
  corps: [COURT.violet, COURT.crimson],
  guild: [COURT.gold, COURT.ivory]
}
