import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import type { FocusResult, InteractionResult, TokenCounts } from '../../../shared/office/types'
import {
  makeAgent,
  makeFloor,
  makeFrame,
  makeRoom,
  makeSession,
  makeZone
} from '../__tests__/fixtures'
import { officeThemes } from '../logic/office-themes'
import { OfficeApp } from '../OfficeApp'
import type { OfficeFeed, OfficeFrame } from '../scene-model'

const NOW = 1_000_000

const counts = (input: number, output = 0, cacheWrite = 0, cacheRead = 0): TokenCounts => ({
  input,
  output,
  cacheWrite,
  cacheRead
})

const ZKIDZ = { companyKey: 'c_zk', companyLabel: 'ZKidz' }
const CLAUDEWATCH = { ...ZKIDZ, projectKey: 'p_cw', projectLabel: 'ClaudeWatch' }
const PROPAPP = { ...ZKIDZ, projectKey: 'p_pa', projectLabel: 'PropApp' }

// One company, two projects: a lead with a subagent and a teammate, an uncounted Codex
// session, and a session waiting on a question.
const frame = makeFrame({
  floors: [
    makeFloor({
      floorId: 'one',
      zones: [
        makeZone({
          id: 'c-zk',
          kind: 'company',
          label: 'ZKidz',
          companyKey: 'c_zk',
          children: [
            makeZone({ id: 'p-cw', kind: 'project', label: 'ClaudeWatch', ...CLAUDEWATCH }),
            makeZone({ id: 'p-pa', kind: 'project', label: 'PropApp', ...PROPAPP })
          ]
        })
      ],
      rooms: [
        makeRoom({ id: 'o-a', sessionKey: 'claude:a', bay: 1 }),
        makeRoom({ id: 'o-b', sessionKey: 'codex:b' }),
        makeRoom({ id: 'o-c', sessionKey: 'claude:c' })
      ]
    })
  ],
  sessions: [
    makeSession({
      ...CLAUDEWATCH,
      key: 'claude:a',
      name: 'office renderer',
      host: 'orca',
      activity: 'editing',
      startedAtMs: NOW - 125_000,
      usage: {
        own: counts(1, 2, 3, 94),
        subagents: counts(50),
        spawned: 31,
        contextTokens: 225_000,
        contextLimit: null
      },
      subagents: [
        { id: 's1', type: 'Explore', activity: 'reading' },
        {
          id: 't1',
          type: 'lena',
          name: 'lena-hud',
          kind: 'teammate',
          activity: 'editing',
          orcaPaneKey: 'pane-2',
          tokens: counts(5, 5)
        }
      ]
    }),
    makeSession({
      ...PROPAPP,
      key: 'codex:b',
      name: 'map clustering',
      provider: 'codex',
      usage: null
    }),
    makeSession({
      ...CLAUDEWATCH,
      key: 'claude:c',
      name: 'listing search',
      attention: 'question',
      updatedAtMs: NOW - 65_000,
      usage: {
        own: counts(7),
        subagents: counts(0),
        spawned: 0,
        contextTokens: 136_000,
        contextLimit: 272_000
      }
    })
  ],
  agents: [
    makeAgent({
      agentKey: 'claude:a',
      floorId: 'one',
      roomId: 'o-a',
      label: 'office renderer',
      activity: 'editing'
    }),
    makeAgent({
      agentKey: 'claude:a#s1',
      floorId: 'one',
      roomId: 'o-a',
      label: 'Explore',
      isSubagent: true
    }),
    makeAgent({
      agentKey: 'claude:a#t1',
      floorId: 'one',
      roomId: 'o-a',
      label: 'lena-hud',
      isSubagent: true,
      activity: 'editing'
    }),
    makeAgent({
      agentKey: 'codex:b',
      floorId: 'one',
      roomId: 'o-b',
      label: 'map clustering',
      provider: 'codex'
    }),
    makeAgent({
      agentKey: 'claude:c',
      floorId: 'one',
      roomId: 'o-c',
      label: 'listing search',
      attention: 'question'
    })
  ]
})

export function setupHud(focusResult: FocusResult = { success: true, target: 'pane' }) {
  let push: (next: OfficeFrame) => void = () => undefined
  const focus = vi.fn(async (): Promise<FocusResult> => focusResult)
  const send = vi.fn(async (): Promise<InteractionResult> => ({ success: true }))
  const peek = vi.fn(async () => ({ success: true, lines: ['$ npm test'] }))
  const feed: OfficeFeed = {
    subscribe: (listener) => {
      push = listener
      return () => undefined
    },
    focus,
    send,
    respond: vi.fn(async (): Promise<InteractionResult> => ({ success: true })),
    peek,
    start: vi.fn(async (): Promise<InteractionResult> => ({ success: true }))
  }
  render(<OfficeApp feed={feed} />)
  act(() => push(frame))
  return { focus, send, peek }
}

export function agentTable(): HTMLElement {
  return screen.getByRole('table', { name: /agents by company and project/i })
}

export function selectAgent(name: string): HTMLElement {
  fireEvent.click(within(agentTable()).getByRole('button', { name: new RegExp(`^${name}`) }))
  return screen.getByRole('complementary', { name: 'Agent details' })
}

export function officesPanel(): HTMLElement {
  return screen.getByRole('navigation', { name: 'Offices' })
}

// The theme store is one per page, so each test starts from no assignments and a fixed clock.
export function resetHud(): () => void {
  localStorage.clear()
  const { companies, projects } = officeThemes.getAssignments()
  for (const key of Object.keys(companies)) officeThemes.clearCompanyTheme(key)
  for (const key of Object.keys(projects)) officeThemes.clearProjectTheme(key)
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW)
  return () => vi.useRealTimers()
}
