import type { OfficeFeed, OfficeFrame } from '../scene-model'
import { PROJECTS } from './fixture-projects'
import { companyKeyFor, sessionFor } from './fixture-sessions'
import type { LayoutMap } from '../../../office/sim/layout'
import { officeThemes } from '../logic/office-themes'
import { VIOLET_COURT_ID } from '../themes/violet-court/roster'
import { fixtureLayout } from './fixture-layout'

export const FIXTURE_TICK_MS = 2000

// Holds the layout between ticks so a running preview keeps its offices in place.
export interface FixtureMemory {
  layout?: LayoutMap
}

export function buildFixtureFrame(
  tick: number,
  nowMs: number,
  memory: FixtureMemory = {}
): OfficeFrame {
  const sessions = PROJECTS.flatMap((project) =>
    project.sessions.map((session, index) => sessionFor(project, session, index, { tick, nowMs }))
  )
  const { floors, agents, layout } = fixtureLayout(sessions, memory.layout, nowMs)
  memory.layout = layout
  return { floors, agents, sessions, connected: true, sources: [] }
}

// Two companies on different themes from the first paint; a reviewer's own choices are kept.
function seedThemes(): void {
  const { companies, projects } = officeThemes.getAssignments()
  if (Object.keys(companies).length + Object.keys(projects).length > 0) return
  officeThemes.setCompanyTheme(companyKeyFor(PROJECTS[0]), VIOLET_COURT_ID)
}

export function createFixtureFeed(options: { tickMs?: number } = {}): OfficeFeed {
  const tickMs = options.tickMs ?? FIXTURE_TICK_MS
  seedThemes()
  return {
    subscribe(listener) {
      let tick = 0
      const memory: FixtureMemory = {}
      listener(buildFixtureFrame(tick, Date.now(), memory))
      const timer = setInterval(() => {
        tick += 1
        listener(buildFixtureFrame(tick, Date.now(), memory))
      }, tickMs)
      return () => clearInterval(timer)
    },
    jump(sessionKey) {
      console.info(`[office preview] jump to terminal for ${sessionKey}`)
    },
    // Codex agents answer the way an unproven pane does, so the preview shows that message too.
    focus: async (agentKey) =>
      agentKey.startsWith('codex:')
        ? { success: false, target: 'app', reason: 'terminal-not-found' }
        : { success: true, target: 'pane' },
    // The browser preview has no agents to talk to; actions succeed so the UI can be exercised.
    send: async () => ({ success: true }),
    respond: async () => ({ success: true }),
    peek: async () => ({
      success: true,
      fingerprint: 'preview-screen',
      lines: [
        '$ npm test',
        '',
        ' ✓ 42 tests passed',
        '',
        'Do you want to proceed?',
        '❯ 1. Yes',
        '  2. No'
      ]
    }),
    start: async () => ({ success: true })
  }
}
