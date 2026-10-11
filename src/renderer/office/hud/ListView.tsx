import { cn } from '../../lib/utils'
import type { CompanyListEntry } from '../logic/zone-model'
import { gemFor } from '../logic/status-gem'
import { PROVIDER_LABEL } from '../office-palette'
import { FOCUS_RING_CLASS, PANEL_CLASS } from './hud-styles'
import { StateChip } from './StateChip'

interface ListViewProps {
  companies: readonly CompanyListEntry[]
  selectedAgentKey: string | null
  onSelectAgent: (agentKey: string) => void
}

const CELL_CLASS = 'px-3 py-1.5 text-left align-middle'

export function ListView({ companies, selectedAgentKey, onSelectAgent }: ListViewProps) {
  return (
    <div className={cn(PANEL_CLASS, 'h-full overflow-auto')}>
      <table className="w-full border-collapse text-body">
        <caption className="sr-only">Agents by company and project</caption>
        <thead className="sticky top-0 bg-surface-raised text-caption text-text-secondary">
          <tr>
            <th scope="col" className={CELL_CLASS}>
              Name
            </th>
            <th scope="col" className={CELL_CLASS}>
              Provider
            </th>
            <th scope="col" className={CELL_CLASS}>
              Activity
            </th>
            <th scope="col" className={CELL_CLASS}>
              Status
            </th>
          </tr>
        </thead>
        {companies.map((company) => (
          <tbody key={company.companyKey} className="border-t border-border">
            <tr>
              <th
                scope="rowgroup"
                colSpan={4}
                className={cn(CELL_CLASS, 'pt-3 text-heading text-text-primary')}
              >
                {company.label}
              </th>
            </tr>
            {company.projects.map((project) => [
              <tr key={project.projectKey}>
                <th
                  scope="row"
                  colSpan={4}
                  className={cn(CELL_CLASS, 'pl-8 font-normal text-text-secondary')}
                >
                  › {project.label}
                </th>
              </tr>,
              ...project.agents.map((agent) => {
                const gem = gemFor(agent)
                const isSelected = agent.agentKey === selectedAgentKey
                return (
                  <tr key={agent.agentKey} className={cn(isSelected && 'bg-accent-muted')}>
                    <td className={cn(CELL_CLASS, agent.isSubagent ? 'pl-[4.5rem]' : 'pl-12')}>
                      <button
                        type="button"
                        aria-current={isSelected ? 'true' : undefined}
                        onClick={() => onSelectAgent(agent.agentKey)}
                        className={cn(
                          FOCUS_RING_CLASS,
                          'rounded text-left text-text-primary hover:underline'
                        )}
                      >
                        {agent.label}
                        {agent.isSubagent && (
                          <span className="ml-1.5 text-caption text-text-secondary">subagent</span>
                        )}
                      </button>
                    </td>
                    <td className={cn(CELL_CLASS, 'text-text-secondary')}>
                      {PROVIDER_LABEL[agent.provider]}
                    </td>
                    <td className={cn(CELL_CLASS, 'text-text-secondary')}>{agent.activity}</td>
                    <td className={CELL_CLASS}>
                      {gem ? (
                        <StateChip spec={gem} />
                      ) : (
                        <span className="text-text-secondary">Idle</span>
                      )}
                    </td>
                  </tr>
                )
              })
            ])}
          </tbody>
        ))}
      </table>
    </div>
  )
}
