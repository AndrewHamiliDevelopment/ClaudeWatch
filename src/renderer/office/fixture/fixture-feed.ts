import type { OfficeFeed, OfficeFrame } from '../scene-model'
import { PROJECTS } from './fixture-projects'
import { sessionFor } from './fixture-sessions'
import type { LayoutMap } from '../../../office/sim/layout'
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

export function createFixtureFeed(options: { tickMs?: number } = {}): OfficeFeed {
  const tickMs = options.tickMs ?? FIXTURE_TICK_MS
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
