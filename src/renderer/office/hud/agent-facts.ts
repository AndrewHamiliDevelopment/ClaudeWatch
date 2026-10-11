import type { AccountRef, SessionRef } from '../../../shared/office/types'
import { sessionTokens } from '../../deck/tokens'
import { memberForAgent, sessionForAgent } from '../logic/floor-model'
import { isTeammate, reachTarget } from '../logic/interactions'
import type { OfficeFrame } from '../scene-model'
import { memberTokens } from './tokens'

type AgentKind = 'lead' | 'subagent' | 'teammate'

export interface AgentFacts {
  kind: AgentKind
  tokens: number | null
  // What Focus terminal is asked for: the agent's own pane, or its parent's for a subagent.
  focusKey: string
}

// One lookup per frame, so a list row does not search the sessions for its agent.
export function buildAgentFacts(frame: OfficeFrame): Map<string, AgentFacts> {
  const facts = new Map<string, AgentFacts>()
  for (const agent of frame.agents) {
    const session = sessionForAgent(frame, agent)
    const member = memberForAgent(session, agent.agentKey)
    const memberCount = member ? memberTokens(member) : null
    facts.set(agent.agentKey, {
      kind: isTeammate(member) ? 'teammate' : agent.isSubagent ? 'subagent' : 'lead',
      tokens: agent.isSubagent ? memberCount : sessionTokens(session?.usage),
      focusKey: session ? reachTarget(session, member).key : agent.agentKey
    })
  }
  return facts
}

// The account a session runs under, as the Office may name it: a label, never an address.
export function accountText(
  session: Pick<SessionRef, 'accountKey' | 'accountConfidence'> | undefined,
  accounts: readonly AccountRef[] | undefined
): string | null {
  if (!session?.accountKey || session.accountConfidence === 'unattributed') return null
  const account = accounts?.find(({ key }) => key === session.accountKey)
  if (!account) return null
  return session.accountConfidence === 'inferred' ? `${account.label} (inferred)` : account.label
}
