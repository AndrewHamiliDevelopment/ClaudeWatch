import type { AgentView } from '../../../../shared/office/types'
import { rosterName } from '../roster-names'
import type { RosterEntry } from '../types'
import { COURT_CAST } from './cast'

export const VIOLET_COURT_ID = 'violet-court'

const LEADS_PER_FACTION = 5
const FIRST_LEAD = { claude: 0, codex: LEADS_PER_FACTION } as const
const SQUAD_MEMBER = { claude: 10, codex: 11 } as const

// The agent's place in COURT_CAST: its provider picks the faction, its office bay the character.
export function castIndexFor(
  agent: Pick<AgentView, 'provider' | 'isSubagent'>,
  rosterIndex: number
): number {
  if (agent.isSubagent) return SQUAD_MEMBER[agent.provider]
  return FIRST_LEAD[agent.provider] + (rosterIndex % LEADS_PER_FACTION)
}

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

// What a HUD shows: the cast with any local renames the owner stored on this machine.
export function violetCourtRoster(storage?: Pick<Storage, 'getItem'> | null): RosterEntry[] {
  return COURT_CAST.map(({ id, name, role }, index) => ({
    id,
    name: rosterName(VIOLET_COURT_ID, index, name, storage),
    role
  }))
}
