import { cn } from '../../lib/utils'
import type { ListFloor } from '../logic/floor-model'
import { gemFor } from '../logic/status-gem'
import { PROVIDER_LABEL } from '../office-palette'
import { FOCUS_RING_CLASS, PANEL_CLASS } from './hud-styles'
import { StateChip } from './StateChip'

interface ListViewProps {
  tree: readonly ListFloor[]
  selectedAgentKey: string | null
  onSelectAgent: (agentKey: string) => void
}

const CELL_CLASS = 'px-3 py-1.5 text-left align-middle'

export function ListView({ tree, selectedAgentKey, onSelectAgent }: ListViewProps) {
  return (
    <div className={cn(PANEL_CLASS, 'h-full overflow-auto')}>
      <table className="w-full border-collapse text-body">
        <caption className="sr-only">Agents by floor and room</caption>
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
        {tree.map((floor, index) => (
          <tbody key={floor.floorId} className="border-t border-border">
            <tr>
              <th
                scope="rowgroup"
                colSpan={4}
                className={cn(CELL_CLASS, 'pt-3 text-heading text-text-primary')}
              >
                <span className="mr-2 font-mono text-text-secondary">{index + 1}</span>
                {floor.label}
              </th>
            </tr>
            {floor.rooms.map((room) => [
              <tr key={room.roomId}>
                <th
                  scope="row"
                  colSpan={4}
                  className={cn(CELL_CLASS, 'pl-8 font-normal text-text-secondary')}
                >
                  › {room.label}
                </th>
              </tr>,
              ...room.agents.map((agent) => {
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
