import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { SquadRoster } from '../components/SquadRoster'
import { buildSquads } from '../deck/roster'
import { DEFAULT_SETTINGS } from '../lib/types'
import { mockApi } from './api-mock'
import { instanceFixture, NOW_MS, sessionFixture } from './fixtures'

const usage = {
  own: { input: 1_200_000, output: 0, cacheWrite: 0, cacheRead: 0 },
  subagents: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  spawned: 0,
  contextTokens: null,
  contextLimit: null
}

const squads = buildSquads(
  [
    instanceFixture({ pid: 1234, terminalApp: 'Ghostty', terminalType: 'ghostty' }),
    instanceFixture({ pid: 77, status: 'idle' })
  ],
  [sessionFixture({ pid: 1234, name: 'token ledger', usage })],
  NOW_MS
)

// Lets the settings read settle, so no state update lands after a test has finished.
async function renderRoster(rosterSquads: Parameters<typeof SquadRoster>[0]['squads']) {
  render(<SquadRoster squads={rosterSquads} />)
  await act(async () => {})
}

function rowOf(agentName: string): HTMLElement {
  const row = screen.getByText(agentName).closest('li')
  if (!row) throw new Error(`no roster row for ${agentName}`)
  return row
}

// The roster reads the muted projects from settings, so every test serves them.
function apiWith(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    getSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
    setSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
    ...overrides
  })
}

describe('SquadRoster', () => {
  beforeEach(() => {
    window.api = apiWith()
  })

  it('tells you when no agent runs', async () => {
    await renderRoster([])
    expect(screen.getByText('No agents running')).toBeInTheDocument()
  })

  it('heads each squad with its project and counts its agents', async () => {
    await renderRoster(squads)
    const squad = screen.getByRole('region', { name: 'ClaudeWatch' })
    expect(within(squad).getByRole('heading', { name: 'ClaudeWatch' })).toBeInTheDocument()
    expect(within(squad).getByText('2 agents')).toBeInTheDocument()
  })

  it('gives every agent a state in words and its tokens when counted', async () => {
    await renderRoster(squads)
    const working = rowOf('token ledger')
    expect(within(working).getByText('Working')).toBeInTheDocument()
    expect(within(working).getByText('1.2M')).toBeInTheDocument()

    const idle = rowOf('Session 77')
    expect(within(idle).getByText('Idle')).toBeInTheDocument()
    expect(within(idle).getByText('Tokens not counted')).toBeInTheDocument()
  })

  it('leaves the token column out when no session is counted', async () => {
    await renderRoster(buildSquads([instanceFixture()], null, NOW_MS))
    expect(screen.queryByText('Tokens not counted')).not.toBeInTheDocument()
  })

  it('keeps the process facts in the expanded row', async () => {
    await renderRoster(squads)
    fireEvent.click(screen.getByRole('button', { name: /token ledger.*Working/ }))

    const details = screen.getByRole('group', { name: 'token ledger details' })
    expect(within(details).getByText('PID 1234')).toBeInTheDocument()
    expect(within(details).getByText('CPU 12.5%')).toBeInTheDocument()
    expect(within(details).getByText('Memory 3.2%')).toBeInTheDocument()
    expect(within(details).getByText('--model opus')).toBeInTheDocument()
  })

  it('jumps to the exact session from the row', async () => {
    const focusSession = vi.fn().mockResolvedValue({ success: true, target: 'pane' })
    window.api = apiWith({ focusSession })
    await renderRoster(squads)

    fireEvent.click(screen.getByRole('button', { name: 'Jump to token ledger' }))

    await waitFor(() => expect(focusSession).toHaveBeenCalledWith(1234))
  })

  it('mutes notifications for the project of an expanded agent', async () => {
    const muteProject = vi.fn().mockResolvedValue({ success: true })
    window.api = apiWith({ muteProject })
    await renderRoster(squads)
    fireEvent.click(screen.getByRole('button', { name: /token ledger.*Working/ }))

    fireEvent.click(await screen.findByRole('button', { name: 'Mute notifications' }))

    expect(muteProject).toHaveBeenCalledWith('/Users/test/ZKidz/ClaudeWatch')
  })
})
