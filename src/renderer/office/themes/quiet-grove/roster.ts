import type { AgentView } from '../../../../shared/office/types'
import { rosterName } from '../roster-names'
import type { RosterEntry } from '../types'
import { GROVE_CAST } from './cast'

export const QUIET_GROVE_ID = 'quiet-grove'

const LEADS_PER_KIN = 5
const FIRST_LEAD = { claude: 0, codex: LEADS_PER_KIN } as const
const SPROUT = { claude: 10, codex: 11 } as const

// The agent's place in GROVE_CAST: its provider picks the kin, its office bay the character.
export function castIndexFor(
  agent: Pick<AgentView, 'provider' | 'isSubagent'>,
  rosterIndex: number
): number {
  if (agent.isSubagent) return SPROUT[agent.provider]
  return FIRST_LEAD[agent.provider] + (rosterIndex % LEADS_PER_KIN)
}

// What a HUD shows: the cast with any local renames the owner stored on this machine.
export function quietGroveRoster(storage?: Pick<Storage, 'getItem'> | null): RosterEntry[] {
  return GROVE_CAST.map(({ id, name, role }, index) => ({
    id,
    name: rosterName(QUIET_GROVE_ID, index, name, storage),
    role
  }))
}
