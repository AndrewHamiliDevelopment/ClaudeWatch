import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import type { InteractionResult, ProviderId } from '../../../shared/office/types'
import { cn } from '../../lib/utils'
import { agentCountLabel, needsYouLabel } from '../logic/floor-model'
import type { OfficeCompanyRow, OfficeProjectRow } from '../logic/zone-model'
import { STATE_COLOR } from '../office-palette'
import { FOCUS_RING_CLASS, PANEL_CLASS } from './hud-styles'
import { NewAgentMenu } from './NewAgentMenu'

interface OfficesPanelProps {
  companies: readonly OfficeCompanyRow[]
  focusedZoneId: string | null
  onFlyToZone: (zoneId: string) => void
  onStart: (projectKey: string, provider: ProviderId) => Promise<InteractionResult>
}

function rowName(row: Pick<OfficeProjectRow, 'label' | 'agentCount' | 'attentionCount'>): string {
  const waiting = row.attentionCount > 0 ? `, ${needsYouLabel(row.attentionCount)}` : ''
  return `${row.label}, ${agentCountLabel(row.agentCount)}${waiting}`
}

function Counts({ row }: { row: Pick<OfficeProjectRow, 'agentCount' | 'attentionCount'> }) {
  return (
    <>
      {row.attentionCount > 0 && (
        <span className="flex items-center gap-0.5 text-mono-sm text-text-primary">
          <span style={{ color: STATE_COLOR.permission }}>!</span>
          {row.attentionCount}
        </span>
      )}
      <span className="min-w-[1.25rem] text-right font-mono text-mono-sm tabular-nums text-text-secondary">
        {row.agentCount}
      </span>
    </>
  )
}

const ROW_CLASS =
  'flex min-w-0 flex-1 items-center gap-2 rounded-md py-1.5 pr-1 text-left transition-colors hover:bg-surface-hover'

// Company › Project tree. A row flies the camera to its zone (rows without a zone yet are
// shown but not clickable); each project row can start a new agent in that project.
export function OfficesPanel({
  companies,
  focusedZoneId,
  onFlyToZone,
  onStart
}: OfficesPanelProps) {
  const [menuProjectKey, setMenuProjectKey] = useState<string | null>(null)
  const toggleRefs = useRef(new Map<string, HTMLButtonElement>())
  const closeMenu = (projectKey: string): void => {
    setMenuProjectKey(null)
    toggleRefs.current.get(projectKey)?.focus()
  }

  return (
    <nav aria-label="Offices" className={cn(PANEL_CLASS, 'flex flex-col gap-2 p-3')}>
      <h2 className="text-heading text-text-primary">Offices</h2>
      <ul className="flex flex-col gap-1">
        {companies.map((company) => (
          <li key={company.companyKey} className="flex flex-col">
            <button
              type="button"
              aria-label={rowName(company)}
              aria-current={
                company.zoneId !== null && company.zoneId === focusedZoneId ? 'true' : undefined
              }
              disabled={company.zoneId === null}
              onClick={() => company.zoneId && onFlyToZone(company.zoneId)}
              className={cn(
                FOCUS_RING_CLASS,
                ROW_CLASS,
                'pl-1.5',
                company.zoneId === focusedZoneId && 'bg-accent-muted'
              )}
            >
              <span className="min-w-0 flex-1 truncate text-heading text-text-primary">
                {company.label}
              </span>
              <Counts row={company} />
            </button>
            <ul className="ml-2 flex flex-col border-l-2 border-border-strong">
              {company.projects.map((project) => (
                <li key={project.projectKey}>
                  <div className="flex items-center">
                    <button
                      type="button"
                      aria-label={rowName(project)}
                      aria-current={
                        project.zoneId !== null && project.zoneId === focusedZoneId
                          ? 'true'
                          : undefined
                      }
                      disabled={project.zoneId === null}
                      onClick={() => project.zoneId && onFlyToZone(project.zoneId)}
                      className={cn(
                        FOCUS_RING_CLASS,
                        ROW_CLASS,
                        'pl-2.5',
                        project.zoneId === focusedZoneId && 'bg-accent-muted'
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                        {project.label}
                      </span>
                      <Counts row={project} />
                    </button>
                    {/* Starting an agent needs a running session's folder; an emptied office has none. */}
                    {project.agentCount > 0 && (
                      <button
                        type="button"
                        ref={(element) => {
                          if (element) toggleRefs.current.set(project.projectKey, element)
                          else toggleRefs.current.delete(project.projectKey)
                        }}
                        aria-label={`New agent in ${project.label}`}
                        aria-expanded={menuProjectKey === project.projectKey}
                        onClick={() =>
                          setMenuProjectKey(
                            menuProjectKey === project.projectKey ? null : project.projectKey
                          )
                        }
                        className={cn(
                          FOCUS_RING_CLASS,
                          'ml-1 shrink-0 rounded-md p-1.5 text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary'
                        )}
                      >
                        <Plus aria-hidden="true" className="size-3.5" />
                      </button>
                    )}
                  </div>
                  {menuProjectKey === project.projectKey && (
                    <NewAgentMenu
                      floorLabel={project.label}
                      onStart={(provider) => onStart(project.projectKey, provider)}
                      onDismiss={() => closeMenu(project.projectKey)}
                    />
                  )}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </nav>
  )
}
