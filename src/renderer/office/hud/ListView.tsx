import { SquareTerminal } from 'lucide-react'
import type { AgentView } from '../../../shared/office/types'
import { ICON_BUTTON_CLASS } from '../../components/deck/deck-styles'
import { Plate } from '../../components/deck/Plate'
import { StateMark } from '../../components/deck/StateMark'
import { cn } from '../../lib/utils'
import type { CompanyListEntry } from '../logic/zone-model'
import { PROVIDER_LABEL } from '../office-palette'
import { agentStateMark, type AgentFacts } from './agent-facts'
import { tokensText } from './tokens'

interface ListViewProps {
  companies: readonly CompanyListEntry[]
  agentFacts: ReadonlyMap<string, AgentFacts>
  selectedAgentKey: string | null
  onSelectAgent: (agentKey: string) => void
  onFocusTerminal: (agentKey: string) => void
}

const COLUMN_COUNT = 6
const CELL_CLASS = 'px-3 py-1.5 text-left align-middle'
const HEADINGS = ['Name', 'Provider', 'Activity', 'Status', 'Tokens', 'Terminal'] as const

interface AgentRowProps extends Pick<ListViewProps, 'onSelectAgent' | 'onFocusTerminal'> {
  agent: AgentView
  facts: AgentFacts | undefined
  isSelected: boolean
}

function AgentRow({ agent, facts, isSelected, onSelectAgent, onFocusTerminal }: AgentRowProps) {
  const mark = agentStateMark(agent)
  return (
    <tr className={cn(isSelected && 'bg-surface-hover')}>
      <td className={cn(CELL_CLASS, agent.isSubagent ? 'pl-[4.5rem]' : 'pl-12')}>
        <button
          type="button"
          aria-current={isSelected ? 'true' : undefined}
          onClick={() => onSelectAgent(agent.agentKey)}
          className="rounded text-left text-text-primary hover:underline aria-[current=true]:font-semibold"
        >
          {agent.label}
          {agent.isSubagent && (
            <span className="ml-1.5 text-caption font-normal text-text-secondary">
              {facts?.kind === 'teammate' ? 'teammate' : 'subagent'}
            </span>
          )}
        </button>
      </td>
      <td className={cn(CELL_CLASS, 'text-text-secondary')}>{PROVIDER_LABEL[agent.provider]}</td>
      <td className={cn(CELL_CLASS, 'text-text-secondary')}>{agent.activity}</td>
      <td className={CELL_CLASS}>
        <StateMark state={mark.state} detail={mark.detail} />
      </td>
      <td
        className={cn(
          CELL_CLASS,
          'tabular-nums',
          facts?.tokens == null ? 'text-text-secondary' : 'text-accent'
        )}
      >
        {tokensText(facts?.tokens ?? null)}
      </td>
      <td className={CELL_CLASS}>
        <button
          type="button"
          aria-label={`Focus terminal for ${agent.label}`}
          title="Focus terminal"
          onClick={() => onFocusTerminal(facts?.focusKey ?? agent.agentKey)}
          className={ICON_BUTTON_CLASS}
        >
          <SquareTerminal aria-hidden="true" className="size-4" />
        </button>
      </td>
    </tr>
  )
}

export function ListView({
  companies,
  agentFacts,
  selectedAgentKey,
  onSelectAgent,
  onFocusTerminal
}: ListViewProps) {
  return (
    <Plate className="h-full" faceClassName="overflow-auto">
      <table className="w-full border-collapse text-body">
        <caption className="sr-only">Agents by company and project</caption>
        <thead className="sticky top-0 bg-surface-raised text-caption text-text-secondary">
          <tr>
            {HEADINGS.map((heading) => (
              <th key={heading} scope="col" className={cn(CELL_CLASS, 'font-medium')}>
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        {companies.map((company) => (
          <tbody key={company.companyKey} className="border-t border-border">
            <tr>
              <th
                scope="rowgroup"
                colSpan={COLUMN_COUNT}
                className={cn(CELL_CLASS, 'pt-3 font-plate text-title text-text-primary')}
              >
                {company.label}
              </th>
            </tr>
            {company.projects.map((project) => [
              <tr key={project.projectKey}>
                <th
                  scope="row"
                  colSpan={COLUMN_COUNT}
                  className={cn(CELL_CLASS, 'pl-8 font-semibold text-text-secondary')}
                >
                  {project.label}
                </th>
              </tr>,
              ...project.agents.map((agent) => (
                <AgentRow
                  key={agent.agentKey}
                  agent={agent}
                  facts={agentFacts.get(agent.agentKey)}
                  isSelected={agent.agentKey === selectedAgentKey}
                  onSelectAgent={onSelectAgent}
                  onFocusTerminal={onFocusTerminal}
                />
              ))
            ])}
          </tbody>
        ))}
      </table>
    </Plate>
  )
}
