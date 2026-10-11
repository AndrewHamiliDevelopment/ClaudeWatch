import { SquareTerminal, X } from 'lucide-react'
import type { ReactNode } from 'react'
import type {
  AccountRef,
  AgentView,
  SessionHost,
  SessionRef,
  SubagentRef
} from '../../../shared/office/types'
import {
  BUTTON_PRIMARY_COMPACT_CLASS,
  BUTTON_QUIET_COMPACT_CLASS,
  ICON_BUTTON_CLASS
} from '../../components/deck/deck-styles'
import { Plate } from '../../components/deck/Plate'
import { StateMark } from '../../components/deck/StateMark'
import { formatElapsedTime } from '../../lib/utils'
import { isTeammate, reachTarget } from '../logic/interactions'
import { PROVIDER_LABEL } from '../office-palette'
import type { RosterEntry } from '../themes/types'
import { accountText, agentStateMark } from './agent-facts'
import { Fact } from './Fact'
import { KBD_INK_CLASS } from './hud-styles'
import { MemberTokenFacts, SessionTokenFacts } from './TokenFacts'

interface InspectorProps {
  agent: AgentView
  session: SessionRef | undefined
  // Set when the agent is a subagent or teammate of `session`.
  member: SubagentRef | undefined
  // The snapshot's accounts; the row is left out until the session's account is among them.
  accounts?: readonly AccountRef[]
  // Who the agent plays in its office's theme, where that theme has a cast.
  character: RosterEntry | null
  nowMs: number
  canFly: boolean
  onFocusTerminal: () => void
  onFly: () => void
  onClose: () => void
  // Interaction panels (work order, talk, review, peek) composed in by the caller.
  children?: ReactNode
}

const HOST_LABEL: Record<SessionHost, string> = {
  orca: 'Orca',
  terminal: 'Terminal',
  vscode: 'VS Code',
  unknown: 'Unknown'
}

function crewLine(session: SessionRef, member: SubagentRef | undefined): string {
  return `${isTeammate(member) ? 'Teammate' : 'Subagent'} of ${session.name}`
}

export function Inspector({
  agent,
  session,
  member,
  accounts,
  character,
  nowMs,
  canFly,
  onFocusTerminal,
  onFly,
  onClose,
  children
}: InspectorProps) {
  const mark = agentStateMark(agent)
  const account = accountText(session, accounts)
  const startedAtMs = member?.startedAtMs ?? session?.startedAtMs
  const elapsedSeconds =
    startedAtMs === undefined ? 0 : Math.max(0, Math.floor((nowMs - startedAtMs) / 1000))
  return (
    <aside aria-label="Agent details">
      <Plate faceClassName="flex flex-col gap-3 p-3">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="truncate pt-[3px] font-plate text-count text-text-primary">
              {agent.label}
            </h2>
            {agent.isSubagent && session && (
              <p className="text-xs text-text-secondary">{crewLine(session, member)}</p>
            )}
            {character && (
              <p className="text-xs text-text-secondary">
                <span className="font-semibold text-gold">{character.name}</span>
                <span className="block">{character.role}</span>
              </p>
            )}
            <StateMark state={mark.state} detail={mark.detail} />
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className={ICON_BUTTON_CLASS}>
            <X aria-hidden="true" className="size-4" />
          </button>
        </div>
        <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1">
          <Fact term="Project" value={session?.projectLabel ?? 'Unknown'} />
          <Fact term="Provider" value={PROVIDER_LABEL[agent.provider]} />
          {account && <Fact term="Account" value={account} />}
          {member && <Fact term="Agent type" value={member.type} />}
          <Fact term="Activity" value={agent.activity} />
          {!agent.isSubagent && <Fact term="Tool" value={session?.currentTool?.name ?? 'None'} />}
          {session && (
            <Fact term="Terminal" value={HOST_LABEL[reachTarget(session, member).host]} />
          )}
          <Fact term="Elapsed" value={formatElapsedTime(elapsedSeconds)} />
          {member && <MemberTokenFacts member={member} />}
          {!agent.isSubagent && session && <SessionTokenFacts session={session} />}
        </dl>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={!session}
            aria-keyshortcuts="F"
            onClick={onFocusTerminal}
            className={BUTTON_PRIMARY_COMPACT_CLASS}
          >
            <SquareTerminal aria-hidden="true" className="size-3.5" />
            Focus terminal
            <kbd aria-hidden="true" className={KBD_INK_CLASS}>
              F
            </kbd>
          </button>
          {canFly && (
            <button type="button" onClick={onFly} className={BUTTON_QUIET_COMPACT_CLASS}>
              Fly to
            </button>
          )}
        </div>
        {children}
      </Plate>
    </aside>
  )
}
