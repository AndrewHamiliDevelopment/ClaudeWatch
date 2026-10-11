import { rosterName } from './roster-names'
import type { RosterEntry, ThemeRoster } from './types'

// A cast lists Claude's leads, then Codex's, then each provider's squad member. That order is
// also the one local renames are stored in.
export function makeRoster(
  themeId: string,
  cast: readonly RosterEntry[],
  leadsPerProvider: number
): ThemeRoster {
  const firstLead = { claude: 0, codex: leadsPerProvider }
  const squadMember = { claude: leadsPerProvider * 2, codex: leadsPerProvider * 2 + 1 }
  return {
    entries: (storage) =>
      cast.map(({ id, name, role }, index) => ({
        id,
        name: rosterName(themeId, index, name, storage),
        role
      })),
    indexFor: (agent, bay) =>
      agent.isSubagent
        ? squadMember[agent.provider]
        : firstLead[agent.provider] + (bay % leadsPerProvider)
  }
}
