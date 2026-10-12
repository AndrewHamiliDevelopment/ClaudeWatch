import type { ProviderId } from '../../../../shared/office/types'
import { makeLooks, makeRoster } from '../roster'
import type { RosterEntry } from '../types'
import { GARRISON_CAST } from './cast'
import { SECTION_ACCENTS, type Section } from './section'

export const ORBITAL_GARRISON_ID = 'orbital-garrison'

const PROVIDER_OF: Record<Section, ProviderId> = {
  wing: 'claude',
  deck: 'codex',
  signal: 'opencode'
}

// The provider picks the section; the agent's own key and its office bay the character in it.
export const orbitalGarrisonRoster = makeRoster(ORBITAL_GARRISON_ID, GARRISON_CAST, (who) => ({
  provider: PROVIDER_OF[who.section],
  isSquad: who.isSquad
}))

export const garrisonLook = makeLooks(
  orbitalGarrisonRoster,
  GARRISON_CAST,
  (who) => SECTION_ACCENTS[who.section]
)

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
