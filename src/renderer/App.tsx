import { useState } from 'react'
import { AccountsView } from './components/accounts/AccountsView'
import { Header, type ViewType } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { ModelsView } from './components/ModelsView'
import { SessionHistory } from './components/SessionHistory'
import { Settings } from './components/Settings'
import { PopoverView } from './components/PopoverView'

const isPopover = window.location.hash === '#popover'

export default function App() {
  const [currentView, setCurrentView] = useState<ViewType>('dashboard')

  if (isPopover) {
    return <PopoverView />
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-24 focus:top-2 focus:z-10 focus:rounded-md focus:bg-accent focus:px-3 focus:py-1 focus:text-xs focus:font-semibold focus:text-ink"
      >
        Skip to content
      </a>
      <Header currentView={currentView} onViewChange={setCurrentView} />
      <main id="main" tabIndex={-1} className="no-drag min-h-0 flex-1 overflow-hidden outline-none">
        {currentView === 'dashboard' && <Dashboard />}
        {currentView === 'accounts' && <AccountsView />}
        {currentView === 'history' && <SessionHistory />}
        {currentView === 'models' && <ModelsView />}
        {currentView === 'settings' && <Settings />}
      </main>
      <footer className="shrink-0 border-t border-border bg-surface-rail py-1 text-center">
        <span className="text-caption text-text-tertiary">by ZKidz Dev</span>
      </footer>
    </div>
  )
}
