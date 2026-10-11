import { makeRoster } from '../roster'
import type { RosterEntry } from '../types'
import { COURT_CAST } from './cast'

export const VIOLET_COURT_ID = 'violet-court'

const LEADS_PER_FACTION = 5

// The provider picks the faction, the office bay the character within it.
export const violetCourtRoster = makeRoster(VIOLET_COURT_ID, COURT_CAST, LEADS_PER_FACTION)

export type FrameKind = 'command' | 'vanguard' | 'lancer'
type CourtFrame = RosterEntry & { kind: FrameKind }

// Original machines, in the order the leads pilot them (bay 0, 1, 2, then round again).
export const COURT_FRAMES: readonly CourtFrame[] = [
  {
    kind: 'command',
    id: 'night-chancellor',
    name: 'Night Chancellor',
    role: 'Black command frame with broad shoulder plates; the seat of the strategist in the field.'
  },
  {
    kind: 'vanguard',
    id: 'ember-vanguard',
    name: 'Ember Vanguard',
    role: 'Crimson close-combat frame; a short blade on each forearm for breaking a line.'
  },
  {
    kind: 'lancer',
    id: 'argent-pike',
    name: 'Argent Pike',
    role: 'White-and-gold lancer frame; the fastest knight on the board.'
  }
]

export function frameForBay(bay: number | undefined): CourtFrame {
  return COURT_FRAMES[(bay ?? 0) % COURT_FRAMES.length]
}
