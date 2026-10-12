import { PLATE_TITLE_CLASS } from '../components/deck/deck-styles'
import { Plate } from '../components/deck/Plate'

// Why the page has no office to show: ClaudeWatch's own window without its bridge, a browser
// tab the launcher did not open, or a tab whose server has gone.
export type OfficeSurface = 'app' | 'web' | 'stopped'

const WHAT_TO_DO: Record<OfficeSurface, string> = {
  app: 'The Office bridge is not available in this window, so it cannot see your agents. Close this window and open the Office again from ClaudeWatch.',
  // The launch link works once and only in the tab it opened.
  web: 'This tab was not opened from the Office launch link, so it cannot see your agents. Go back to the tab the launcher opened, or start ClaudeWatch Office again and open the link it prints.',
  stopped:
    'The Office server has stopped, or it no longer accepts this tab. Start the Office again and use the tab it opens.'
}

// Shown instead of the office when the page has no way to reach the agents.
export function NotConnected({ surface }: { surface: OfficeSurface }) {
  return (
    <main className="grid h-screen w-screen place-items-center bg-surface p-6 text-text-primary">
      <Plate className="max-w-sm" faceClassName="flex flex-col gap-1.5 p-5">
        <h1 className={PLATE_TITLE_CLASS}>Not connected</h1>
        <p className="text-body text-text-secondary">{WHAT_TO_DO[surface]}</p>
      </Plate>
    </main>
  )
}
