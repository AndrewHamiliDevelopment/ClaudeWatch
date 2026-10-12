import { useState } from 'react'
import { Bell, BellOff, Bot, ChevronDown, SquareTerminal } from 'lucide-react'
import { useElapsedSeconds } from '../hooks/useElapsedSeconds'
import { jumpToAgent } from '../deck/deck-api'
import type { RosterAgent } from '../deck/roster'
import { formatTokens } from '../deck/tokens'
import { cn, formatElapsedTime } from '../lib/utils'
import { BUTTON_QUIET_COMPACT_CLASS, ICON_BUTTON_CLASS } from './deck/deck-styles'
import { StateMark } from './deck/StateMark'

// Shared with the column captions so the two always line up.
export const ROSTER_COLUMNS_CLASS = 'grid-cols-[22px_minmax(0,1fr)_150px_60px]'
export const ROSTER_COLUMNS_WITH_TOKENS_CLASS = 'grid-cols-[22px_minmax(0,1fr)_150px_60px_46px]'

interface AgentRowProps {
  agent: RosterAgent
  showTokens: boolean
  isMuted: boolean
  onToggleMute: (projectPath: string, shouldMute: boolean) => void
}

export function AgentRow({ agent, showTokens, isMuted, onToggleMute }: AgentRowProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const elapsedSeconds = useElapsedSeconds(agent.instance)
  const { instance } = agent
  const terminalName = instance.terminalApp ?? 'Terminal'

  return (
    <li className="border-b border-border/40">
      <div className="flex items-center gap-1 pr-1 hover:bg-surface-raised">
        <button
          type="button"
          onClick={() => setIsExpanded((wasExpanded) => !wasExpanded)}
          aria-expanded={isExpanded}
          className={cn(
            'grid h-8 min-w-0 flex-1 items-center gap-2.5 pl-2 text-left text-body',
            showTokens ? ROSTER_COLUMNS_WITH_TOKENS_CLASS : ROSTER_COLUMNS_CLASS
          )}
        >
          <Bot className="size-[18px] text-brass" aria-hidden="true" />
          <span className="truncate font-semibold text-text-primary">{agent.name}</span>
          <StateMark state={agent.state} detail={agent.stateDetail} />
          <span className="text-right tabular-nums text-text-secondary">
            <span className="sr-only">running </span>
            {formatElapsedTime(elapsedSeconds)}
          </span>
          {showTokens && <TokenCell tokens={agent.tokens} />}
        </button>
        <ChevronDown
          className={cn(
            'size-3.5 shrink-0 text-text-tertiary transition-transform',
            isExpanded && 'rotate-180'
          )}
          aria-hidden="true"
        />
        <button
          type="button"
          onClick={() =>
            void jumpToAgent({
              pid: agent.pid,
              projectPath: instance.projectPath,
              terminalType: instance.terminalType
            })
          }
          aria-label={`Jump to ${agent.name}`}
          title={agent.isInOrca ? 'Focus its pane in Orca' : `Open in ${terminalName}`}
          className={ICON_BUTTON_CLASS}
        >
          <SquareTerminal className="size-4" aria-hidden="true" />
        </button>
      </div>

      {isExpanded && (
        <div
          role="group"
          aria-label={`${agent.name} details`}
          className="flex flex-col gap-2 bg-surface-rail px-3 py-2.5 text-xs text-text-secondary"
        >
          <p className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
            <span>PID {instance.pid}</span>
            <span>CPU {instance.cpuPercent.toFixed(1)}%</span>
            <span>Memory {instance.memPercent.toFixed(1)}%</span>
            <span>Terminal {instance.terminalApp ?? instance.tty}</span>
            {instance.sessionType && instance.sessionType !== 'cli' && (
              <span>Runs in {instance.sessionType}</span>
            )}
          </p>
          <p className="select-text truncate font-mono text-caption" title={instance.projectPath}>
            {instance.projectPath}
          </p>
          {instance.sessionId && (
            <p className="select-text truncate font-mono text-caption">
              Session {instance.sessionId}
            </p>
          )}
          {instance.flags.length > 0 && (
            <p className="select-text font-mono text-caption">{instance.flags.join(' ')}</p>
          )}
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => onToggleMute(instance.projectPath, !isMuted)}
              aria-label={isMuted ? 'Unmute notifications' : 'Mute notifications'}
              className={BUTTON_QUIET_COMPACT_CLASS}
            >
              {isMuted ? (
                <BellOff className="size-3.5" aria-hidden="true" />
              ) : (
                <Bell className="size-3.5" aria-hidden="true" />
              )}
              {isMuted ? 'Unmute' : 'Mute'}
            </button>
          </div>
        </div>
      )}
    </li>
  )
}

function TokenCell({ tokens }: { tokens: number | null }) {
  if (tokens === null) {
    return (
      <span className="text-right text-text-tertiary">
        <span aria-hidden="true">–</span>
        <span className="sr-only">Tokens not counted</span>
      </span>
    )
  }
  return (
    <span className="text-right font-semibold tabular-nums text-text-primary">
      {formatTokens(tokens)}
      <span className="sr-only"> tokens</span>
    </span>
  )
}
