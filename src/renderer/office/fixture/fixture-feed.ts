import type { OfficeFeed, OfficeFrame } from '../scene-model'
import { PROJECTS } from './fixture-projects'
import { sessionFor } from './fixture-sessions'
import { fixtureLayout } from './fixture-layout'

export const FIXTURE_TICK_MS = 2000

export function buildFixtureFrame(tick: number, nowMs: number): OfficeFrame {
  const sessions = PROJECTS.flatMap((project) =>
    project.sessions.map((session, index) => sessionFor(project, session, index, { tick, nowMs }))
  )
  return { ...fixtureLayout(sessions), sessions }
}

export function createFixtureFeed(options: { tickMs?: number } = {}): OfficeFeed {
  const tickMs = options.tickMs ?? FIXTURE_TICK_MS
  return {
    subscribe(listener) {
      let tick = 0
      listener(buildFixtureFrame(tick, Date.now()))
      const timer = setInterval(() => {
        tick += 1
        listener(buildFixtureFrame(tick, Date.now()))
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
