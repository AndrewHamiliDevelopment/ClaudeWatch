import type { ProviderId } from '../../../../shared/office/types'
import { makeLooks, makeRoster } from '../roster'
import type { RosterEntry } from '../types'
import { COURT_CAST } from './cast'
import { FACTION_ACCENTS, type Faction } from './faction'

export const VIOLET_COURT_ID = 'violet-court'

const PROVIDER_OF: Record<Faction, ProviderId> = {
  order: 'claude',
  corps: 'codex',
  guild: 'opencode'
}

// The provider picks the faction; the agent's own key and its office bay the character in it.
export const violetCourtRoster = makeRoster(VIOLET_COURT_ID, COURT_CAST, (who) => ({
  provider: PROVIDER_OF[who.faction],
  isSquad: who.isSquad
}))

export const courtLook = makeLooks(
  violetCourtRoster,
  COURT_CAST,
  (who) => FACTION_ACCENTS[who.faction]
)

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
