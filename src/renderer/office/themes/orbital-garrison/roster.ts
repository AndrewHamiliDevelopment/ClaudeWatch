import type { AgentView } from '../../../../shared/office/types'
import { rosterName } from '../roster-names'
import type { RosterEntry } from '../types'
import {
  DECK_LEADS,
  DECKHAND,
  GARRISON_CAST,
  WING_CADET,
  WING_LEADS,
  type GarrisonCharacter
} from './cast'

export const ORBITAL_GARRISON_ID = 'orbital-garrison'

const SECTIONS = {
  claude: { leads: WING_LEADS, squad: WING_CADET },
  codex: { leads: DECK_LEADS, squad: DECKHAND }
} as const

// The provider picks the section, the office bay the lead; a subagent is always the squad member.
export function characterFor(
  agent: Pick<AgentView, 'provider' | 'isSubagent'>,
  rosterIndex: number
): GarrisonCharacter {
  const { leads, squad } = SECTIONS[agent.provider]
  return agent.isSubagent ? squad : leads[rosterIndex % leads.length]
}

export type FrameKind = 'trooper' | 'heavy' | 'scout'
type GarrisonFrame = RosterEntry & { kind: FrameKind }

// Original machines, in the order the bays park them.
export const GARRISON_FRAMES: readonly GarrisonFrame[] = [
  {
    kind: 'trooper',
    id: 'picket',
    name: 'Picket',
    role: 'Steel-grey line trooper frame; a slab shield, a rifle and a place in the formation.'
  },
  {
    kind: 'heavy',
    id: 'longbow',
    name: 'Longbow',
    role: 'Dark heavy artillery frame; twin shoulder guns and feet that dig into the deck.'
  },
  {
    kind: 'scout',
    id: 'sparrowhawk',
    name: 'Sparrowhawk',
    role: 'Hazard-orange fast scout frame; thruster fins, a sensor dish and very little armour.'
  }
]

// The lead office (bay 0) is the commander's bridge; every other office parks a frame.
export function dressingForBay(bay: number | undefined): FrameKind | 'bridge' {
  if (bay === 0) return 'bridge'
  return GARRISON_FRAMES[((bay ?? 1) - 1) % GARRISON_FRAMES.length].kind
}

// What a HUD shows: the cast with any local renames the owner stored on this machine.
export function orbitalGarrisonRoster(storage?: Pick<Storage, 'getItem'> | null): RosterEntry[] {
  return GARRISON_CAST.map(({ id, name, role }, index) => ({
    id,
    name: rosterName(ORBITAL_GARRISON_ID, index, name, storage),
    role
  }))
}
