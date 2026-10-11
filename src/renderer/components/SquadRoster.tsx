import { useId } from 'react'
import { Bot } from 'lucide-react'
import { useSettings } from '../hooks/useSettings'
import type { Squad } from '../deck/roster'
import { agentCountLabel, needsYouLabel } from '../office/logic/floor-model'
import { formatTotal } from '../deck/tokens'
import { cn } from '../lib/utils'
import { AgentRow, ROSTER_COLUMNS_CLASS, ROSTER_COLUMNS_WITH_TOKENS_CLASS } from './AgentRow'
import { Crest } from './deck/Plate'
import { StateIcon } from './deck/StateMark'

export function SquadRoster({ squads }: { squads: readonly Squad[] }) {
  const { settings, updateSettings } = useSettings()
  const mutedProjects = settings.notifications.mutedProjects ?? []
  const showTokens = squads.some((squad) => squad.tokens !== null)

  const handleToggleMute = (projectPath: string, shouldMute: boolean): void => {
    const request = shouldMute
      ? window.api?.muteProject(projectPath)
      : window.api?.unmuteProject(projectPath)
    void request?.then(() =>
      updateSettings({
        notifications: {
          ...settings.notifications,
          mutedProjects: shouldMute
            ? [...mutedProjects, projectPath]
            : mutedProjects.filter((mutedPath) => mutedPath !== projectPath)
        }
      })
    )
  }

  if (squads.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-14 text-center" role="status">
        <Bot className="size-10 text-text-tertiary" aria-hidden="true" />
        <p className="text-body font-semibold text-text-secondary">No agents running</p>
        <p className="text-xs text-text-tertiary">
          Start Claude Code in a terminal and its squad appears here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div
        aria-hidden="true"
        className={cn(
          'grid h-5 items-center gap-2.5 pl-2 pr-[54px] text-caption text-text-tertiary',
          showTokens ? ROSTER_COLUMNS_WITH_TOKENS_CLASS : ROSTER_COLUMNS_CLASS
        )}
      >
        <span className="col-span-2">Agent</span>
        <span>State</span>
        <span className="text-right">Elapsed</span>
        {showTokens && <span className="text-right">Tokens</span>}
      </div>
      {squads.map((squad) => (
        <SquadSection
          key={squad.key}
          squad={squad}
          showTokens={showTokens}
          mutedProjects={mutedProjects}
          onToggleMute={handleToggleMute}
        />
      ))}
    </div>
  )
}

interface SquadSectionProps {
  squad: Squad
  showTokens: boolean
  mutedProjects: readonly string[]
  onToggleMute: (projectPath: string, shouldMute: boolean) => void
}

function SquadSection({ squad, showTokens, mutedProjects, onToggleMute }: SquadSectionProps) {
  const headingId = useId()

  return (
    <section aria-labelledby={headingId}>
      <div className="flex h-7 items-center gap-2 border-b border-border bg-surface-rail pl-2 pr-2">
        <Crest letters={squad.crest} />
        <h3 id={headingId} className="pt-[3px] font-plate text-[17px] font-bold leading-none">
          {squad.name}
        </h3>
        <span className="mr-auto truncate text-caption text-text-tertiary">{squad.company}</span>
        {squad.needsYouCount > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-text-primary">
            <StateIcon state="needs-you" />
            {needsYouLabel(squad.needsYouCount)}
          </span>
        )}
        <span className="text-xs text-text-secondary">{agentCountLabel(squad.agents.length)}</span>
        {squad.tokens !== null && (
          <span className="min-w-14 text-right text-xs tabular-nums text-accent">
            {formatTotal(squad.tokens, squad.isTokensPartial)}
            <span className="sr-only">{squad.isTokensPartial ? ' or more tokens' : ' tokens'}</span>
          </span>
        )}
      </div>
      <ul>
        {squad.agents.map((agent) => (
          <AgentRow
            key={agent.pid}
            agent={agent}
            showTokens={showTokens}
            isMuted={mutedProjects.includes(agent.instance.projectPath)}
            onToggleMute={onToggleMute}
          />
        ))}
      </ul>
    </section>
  )
}
