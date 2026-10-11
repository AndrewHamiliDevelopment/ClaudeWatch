import type { AgentView } from '../../../../shared/office/types'
import { makeRoster } from '../roster'
import type { RosterEntry } from '../types'
import { GARRISON_CAST, WING_LEADS, type GarrisonCharacter } from './cast'

export const ORBITAL_GARRISON_ID = 'orbital-garrison'

// The provider picks the section, the office bay the lead within it.
export const orbitalGarrisonRoster = makeRoster(
  ORBITAL_GARRISON_ID,
  GARRISON_CAST,
  WING_LEADS.length
)

export function characterFor(
  agent: Pick<AgentView, 'provider' | 'isSubagent'>,
  rosterIndex: number
): GarrisonCharacter {
  return GARRISON_CAST[orbitalGarrisonRoster.indexFor(agent, rosterIndex)]
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
