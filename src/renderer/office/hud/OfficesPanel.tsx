import { Plus } from 'lucide-react'
import { useRef, useState } from 'react'
import type { InteractionResult, ProviderId } from '../../../shared/office/types'
import { ICON_BUTTON_CLASS, PLATE_TITLE_CLASS } from '../../components/deck/deck-styles'
import { Plate } from '../../components/deck/Plate'
import { agentCountLabel } from '../logic/floor-model'
import type { CompanyThemeRow, ThemeTarget } from '../logic/office-themes'
import type { OfficeCompanyRow } from '../logic/zone-model'
import { getTheme } from '../themes/registry'
import { NewAgentMenu } from './NewAgentMenu'
import { ThemeToggle, ZoneButton } from './OfficeRow'
import { OfficeThemePicker } from './ThemePicker'
import type { TokenLedger } from '../../deck/tokens'
import { tokensText } from './tokens'

interface OfficesPanelProps {
  companies: readonly OfficeCompanyRow[]
  ledger: TokenLedger
  // One per company, in the same order, with one per project inside.
  themeRows: readonly CompanyThemeRow[]
  onChooseTheme: (target: ThemeTarget, themeId: string | null) => void
  focusedZoneId: string | null
  onFlyToZone: (zoneId: string) => void
  // Null where the page may only watch: then no office offers a new agent.
  onStart: ((projectKey: string, provider: ProviderId) => Promise<InteractionResult>) | null
}

// Company › Project tree: each row flies to its zone and picks its theme, and a project row
// can start a new agent. One menu is open at a time.
export function OfficesPanel({
  companies,
  ledger,
  themeRows,
  onChooseTheme,
  focusedZoneId,
  onFlyToZone,
  onStart
}: OfficesPanelProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)
  const toggleRefs = useRef(new Map<string, HTMLButtonElement>())
  const refFor = (menuId: string) => (element: HTMLButtonElement | null) => {
    if (element) toggleRefs.current.set(menuId, element)
    else toggleRefs.current.delete(menuId)
  }
  const toggleMenu = (menuId: string): void =>
    setOpenMenuId((current) => (current === menuId ? null : menuId))
  const closeMenu = (menuId: string): void => {
    setOpenMenuId(null)
    toggleRefs.current.get(menuId)?.focus()
  }
  const agentTotal = companies.reduce((total, company) => total + company.agentCount, 0)

  return (
    <nav aria-label="Offices">
      <Plate faceClassName="flex max-h-[46vh] flex-col gap-1.5 overflow-y-auto p-3">
        <h2 className={PLATE_TITLE_CLASS}>Offices</h2>
        <ul className="flex flex-col gap-0.5">
          <li className="flex min-h-[30px] items-center gap-2 px-1.5 text-xs text-text-secondary">
            <span className="flex-1">All offices</span>
            <span>{agentCountLabel(agentTotal)}</span>
            {agentTotal > 0 && (
              <span className="tabular-nums text-accent">
                {tokensText(ledger.office, ledger.isOfficePartial)}
              </span>
            )}
          </li>
          {companies.map((company, companyIndex) => {
            const companyTheme = themeRows[companyIndex]
            const companyMenuId = `theme:company:${company.companyKey}`
            return (
              <li key={company.companyKey} className="flex flex-col">
                <div className="flex items-center gap-0.5">
                  <ZoneButton
                    row={company}
                    tokens={ledger.companies.get(company.companyKey)}
                    isPartial={ledger.partialCompanies.has(company.companyKey)}
                    focusedZoneId={focusedZoneId}
                    onFlyToZone={onFlyToZone}
                  >
                    <span className="min-w-0 flex-1 truncate pt-[3px] font-plate text-base font-bold leading-none text-text-primary">
                      {company.label}
                    </span>
                  </ZoneButton>
                </div>
                <ThemeToggle
                  zoneLabel={company.label}
                  theme={getTheme(companyTheme.themeId)}
                  isOpen={openMenuId === companyMenuId}
                  onToggle={() => toggleMenu(companyMenuId)}
                  buttonRef={refFor(companyMenuId)}
                />
                {openMenuId === companyMenuId && (
                  <OfficeThemePicker
                    row={companyTheme}
                    onChoose={onChooseTheme}
                    onDismiss={() => closeMenu(companyMenuId)}
                  />
                )}
                <ul className="ml-2.5 flex flex-col gap-0.5 border-l border-border pl-1">
                  {company.projects.map((project, projectIndex) => {
                    const projectTheme = companyTheme.projects[projectIndex]
                    const themeMenuId = `theme:project:${project.projectKey}`
                    const agentMenuId = `agent:${project.projectKey}`
                    return (
                      <li key={project.projectKey} className="flex flex-col">
                        <div className="flex items-center gap-0.5">
                          <ZoneButton
                            row={project}
                            tokens={ledger.projects.get(project.projectKey)}
                            isPartial={ledger.partialProjects.has(project.projectKey)}
                            focusedZoneId={focusedZoneId}
                            onFlyToZone={onFlyToZone}
                          >
                            <span className="min-w-0 flex-1 truncate text-body text-text-primary">
                              {project.label}
                            </span>
                          </ZoneButton>
                          {/* Starting an agent needs a running session's folder; an emptied office has none. */}
                          {onStart && project.agentCount > 0 && (
                            <button
                              type="button"
                              ref={refFor(agentMenuId)}
                              aria-label={`New agent in ${project.label}`}
                              aria-expanded={openMenuId === agentMenuId}
                              onClick={() => toggleMenu(agentMenuId)}
                              className={ICON_BUTTON_CLASS}
                            >
                              <Plus aria-hidden="true" className="size-3.5" />
                            </button>
                          )}
                        </div>
                        <ThemeToggle
                          zoneLabel={project.label}
                          theme={getTheme(projectTheme.themeId)}
                          isOpen={openMenuId === themeMenuId}
                          onToggle={() => toggleMenu(themeMenuId)}
                          buttonRef={refFor(themeMenuId)}
                        />
                        {openMenuId === themeMenuId && (
                          <OfficeThemePicker
                            row={projectTheme}
                            onChoose={onChooseTheme}
                            onDismiss={() => closeMenu(themeMenuId)}
                          />
                        )}
                        {onStart && openMenuId === agentMenuId && (
                          <NewAgentMenu
                            floorLabel={project.label}
                            onStart={(provider) => onStart(project.projectKey, provider)}
                            onDismiss={() => closeMenu(agentMenuId)}
                          />
                        )}
                      </li>
                    )
                  })}
                </ul>
              </li>
            )
          })}
        </ul>
      </Plate>
    </nav>
  )
}
