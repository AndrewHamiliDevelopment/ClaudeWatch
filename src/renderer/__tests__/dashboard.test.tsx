import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import { Dashboard } from '../components/Dashboard'
import { ModelsView } from '../components/ModelsView'
import { DEFAULT_SETTINGS, type InstanceUpdate, type UsageStats } from '../lib/types'
import { mockApi } from './api-mock'
import { instanceFixture, NOW_MS, sessionFixture } from './fixtures'

const instances = [
  instanceFixture({ pid: 1234, status: 'idle' }),
  instanceFixture({ pid: 2, projectPath: '/w/PropApp', projectName: 'w/PropApp' })
]

const update: InstanceUpdate = {
  instances,
  stats: { total: 2, active: 1, idle: 1, stale: 0, exited: 0, recentlyCompleted: 0 }
}

const snapshot = {
  rev: 1,
  generatedAtMs: NOW_MS,
  sessions: [sessionFixture({ pid: 1234, name: 'token ledger', attention: 'permission' as const })],
  sources: []
}

const usage: UsageStats = {
  totalInputTokens: 420_000,
  totalOutputTokens: 85_000,
  totalCacheReadTokens: 730_000,
  totalCacheCreationTokens: 0,
  totalCostUSD: 71.2,
  modelUsage: [
    {
      model: 'claude-opus-5',
      inputTokens: 400_000,
      outputTokens: 80_000,
      cacheReadInputTokens: 700_000,
      cacheCreationInputTokens: 0,
      costUSD: 70
    }
  ],
  dataAvailable: true,
  lastUpdated: null,
  weeklyTokens: 8_200_000,
  weeklyTokenTarget: 10_000_000
}

function apiWith(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    getInstances: vi.fn().mockResolvedValue(update),
    getSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
    setSettings: vi.fn().mockResolvedValue(DEFAULT_SETTINGS),
    ...overrides
  })
}

describe('Dashboard', () => {
  beforeEach(() => {
    window.api = apiWith()
  })

  it('lists the squads by project with a count in the resource bar', async () => {
    render(<Dashboard />)

    expect(await screen.findByRole('region', { name: 'ClaudeWatch' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'PropApp' })).toBeInTheDocument()
    const resources = screen.getByRole('region', { name: 'Resources' })
    expect(within(resources).getByText('squads').previousSibling).toHaveTextContent('2')
  })

  it('has no Needs you lane while the office feed is unavailable', async () => {
    render(<Dashboard />)
    await screen.findByRole('region', { name: 'ClaudeWatch' })

    expect(screen.queryByRole('heading', { name: 'Needs you' })).not.toBeInTheDocument()
  })

  it('puts the agent that waits on you on a slip above the roster and counts it', async () => {
    window.api = apiWith({ getOfficeSnapshot: vi.fn().mockResolvedValue(snapshot) })
    render(<Dashboard />)

    const slip = await screen.findByRole('button', { name: 'Review token ledger' })
    const roster = screen.getByRole('heading', { name: 'Squads' })
    expect(slip.compareDocumentPosition(roster) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    const resources = screen.getByRole('region', { name: 'Resources' })
    expect(within(resources).getByText('1 needs you')).toBeInTheDocument()
  })

  it('finds an agent by name', async () => {
    window.api = apiWith({ getOfficeSnapshot: vi.fn().mockResolvedValue(snapshot) })
    render(<Dashboard />)
    await screen.findByRole('region', { name: 'PropApp' })

    fireEvent.change(screen.getByRole('searchbox', { name: 'Find an agent' }), {
      target: { value: 'ledger' }
    })

    expect(screen.queryByRole('region', { name: 'PropApp' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'ClaudeWatch' })).toBeInTheDocument()
  })

  it('says so when the search matches nobody', async () => {
    render(<Dashboard />)
    await screen.findByRole('region', { name: 'PropApp' })

    fireEvent.change(screen.getByRole('searchbox', { name: 'Find an agent' }), {
      target: { value: 'nobody-by-this-name' }
    })

    expect(screen.getByText('No agent matches “nobody-by-this-name”.')).toBeInTheDocument()
  })
})

describe('ModelsView', () => {
  it('lists usage per model with the totals', async () => {
    window.api = apiWith({ getUsage: vi.fn().mockResolvedValue(usage) })
    render(<ModelsView />)

    const row = (await screen.findByText('claude-opus-5')).closest('tr')
    expect(row).toHaveTextContent('400K')
    expect(row).toHaveTextContent('$70.00')
    expect(screen.getByText('$71.20')).toBeInTheDocument()
  })

  it('explains an empty page when Claude Code has no usage data', async () => {
    window.api = apiWith({
      getUsage: vi.fn().mockResolvedValue({ ...usage, dataAvailable: false })
    })
    render(<ModelsView />)

    expect(await screen.findByText('Claude Code usage data not found')).toBeInTheDocument()
  })
})

describe('App shell', () => {
  beforeEach(() => {
    window.api = apiWith({
      getUsage: vi.fn().mockResolvedValue(usage),
      getHistory: vi.fn().mockResolvedValue([])
    })
  })

  it('reaches Models, History and Settings from the title bar', async () => {
    render(<App />)

    fireEvent.click(screen.getByRole('button', { name: 'Models' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Models' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'History' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'History' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument()
  })
})
