import type { AgentView } from '../../../shared/office/types'
import { violetCourtRoster } from '../themes/violet-court'
import type { RosterEntry } from '../themes/violet-court/cast'
import { castIndexFor, VIOLET_COURT_ID } from '../themes/violet-court/roster'

// Violet Court is the one theme with a cast; a theme without one gives its agents no character.
export function characterFor(
  themeId: string,
  agent: Pick<AgentView, 'provider' | 'isSubagent'>,
  bay: number
): RosterEntry | null {
  if (themeId !== VIOLET_COURT_ID) return null
  return violetCourtRoster()[castIndexFor(agent, bay)] ?? null
}
