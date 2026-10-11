import { Lamp } from 'lucide-react'
import { cn } from '../lib/utils'

export type ViewType = 'dashboard' | 'history' | 'models' | 'settings'

interface HeaderProps {
  currentView: ViewType
  onViewChange: (view: ViewType) => void
}

const pages: { view: ViewType; label: string }[] = [
  { view: 'dashboard', label: 'Dashboard' },
  { view: 'history', label: 'History' },
  { view: 'models', label: 'Models' },
  { view: 'settings', label: 'Settings' }
]

export function Header({ currentView, onViewChange }: HeaderProps) {
  return (
    <header
      className="drag-region flex h-11 shrink-0 items-stretch gap-4 bg-surface-rail pr-3"
      role="banner"
    >
      {/* Room for the macOS traffic lights. */}
      <div className="w-[78px] shrink-0" aria-hidden="true" />

      <div className="flex items-center gap-1.5 pt-[3px] font-plate text-[19px] font-bold leading-none">
        <Lamp className="-mt-[3px] size-4 text-gold" aria-hidden="true" />
        ClaudeWatch
      </div>

      <nav aria-label="Main navigation" className="flex items-stretch gap-0.5">
        {pages.map(({ view, label }) => {
          const isCurrent = currentView === view
          return (
            <button
              key={view}
              type="button"
              onClick={() => onViewChange(view)}
              aria-current={isCurrent ? 'page' : undefined}
              className={cn(
                'relative px-3 text-body transition-colors',
                isCurrent
                  ? 'font-semibold text-text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:bg-brass'
                  : 'font-medium text-text-secondary hover:text-text-primary'
              )}
            >
              {label}
            </button>
          )
        })}
      </nav>
    </header>
  )
}
