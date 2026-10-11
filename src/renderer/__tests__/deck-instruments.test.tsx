import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { SegmentedMeter } from '../components/deck/SegmentedMeter'
import { GaugeWall } from '../components/GaugeWall'
import { ResourceBar } from '../components/ResourceBar'
import { buildSquads } from '../deck/roster'
import type { RateLimits, UsageStats } from '../lib/types'
import { mockApi } from './api-mock'
import { instanceFixture, NOW_MS, sessionFixture } from './fixtures'

const usage: UsageStats = {
  totalInputTokens: 420_000,
  totalOutputTokens: 85_000,
  totalCacheReadTokens: 730_000,
  totalCacheCreationTokens: 0,
  totalCostUSD: 71.2,
  modelUsage: [],
  dataAvailable: true,
  lastUpdated: null,
  weeklyTokens: 8_200_000,
  weeklyTokenTarget: 10_000_000
}

const rateLimits: RateLimits = {
  window_5h: { used_percentage: 88, resets_at: new Date(Date.now() + 42 * 60_000).toISOString() },
  window_7d: { used_percentage: 57, resets_at: null },
  updated_at: new Date().toISOString(),
  dataAvailable: true,
  isStale: false,
  isVeryStale: false
}

const sessionUsage = (input: number) => ({
  own: { input, output: 0, cacheWrite: 0, cacheRead: 0 },
  subagents: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
  spawned: 0,
  contextTokens: null,
  contextLimit: null
})

const squads = buildSquads(
  [
    instanceFixture({ pid: 1 }),
    instanceFixture({ pid: 2, projectPath: '/w/PropApp', projectName: 'w/PropApp' })
  ],
  [
    sessionFixture({ key: 'claude:a', pid: 1, usage: sessionUsage(3_000_000) }),
    sessionFixture({
      key: 'claude:b',
      pid: 2,
      projectRoot: '/w/PropApp',
      projectLabel: 'PropApp',
      usage: sessionUsage(1_000_000)
    })
  ],
  NOW_MS
)

describe('SegmentedMeter', () => {
  it('is a meter with a name and a value a screen reader can read', () => {
    render(<SegmentedMeter label="5-hour limit" percent={88.4} valueText="88%, 42m left" />)
    const meter = screen.getByRole('meter', { name: '5-hour limit' })
    expect(meter).toHaveAttribute('aria-valuenow', '88')
    expect(meter).toHaveAttribute('aria-valuetext', '88%, 42m left')
  })

  it('never reports more than full or less than empty', () => {
    render(
      <>
        <SegmentedMeter label="over" percent={140} valueText="140%" />
        <SegmentedMeter label="under" percent={-5} valueText="0%" />
      </>
    )
    expect(screen.getByRole('meter', { name: 'over' })).toHaveAttribute('aria-valuenow', '100')
    expect(screen.getByRole('meter', { name: 'under' })).toHaveAttribute('aria-valuenow', '0')
  })
})

describe('ResourceBar', () => {
  const counts = { squadCount: 4, agentCount: 10 }

  it('counts squads and agents', () => {
    render(<ResourceBar {...counts} needsYouCount={null} usage={null} rateLimits={null} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('squads')).toBeInTheDocument()
    expect(screen.getByText('10')).toBeInTheDocument()
    expect(screen.getByText('agents')).toBeInTheDocument()
  })

  it('shows who needs you only when someone does', () => {
    const { rerender } = render(
      <ResourceBar {...counts} needsYouCount={2} usage={null} rateLimits={null} />
    )
    expect(screen.getByText('2 need you')).toBeInTheDocument()

    rerender(<ResourceBar {...counts} needsYouCount={0} usage={null} rateLimits={null} />)
    expect(screen.queryByText(/need you/)).not.toBeInTheDocument()
  })

  it('shows the week of tokens, the cost and the 5-hour limit with its number', () => {
    render(<ResourceBar {...counts} needsYouCount={null} usage={usage} rateLimits={rateLimits} />)
    expect(screen.getByText('8.2M')).toBeInTheDocument()
    expect(screen.getByText('tokens this week')).toBeInTheDocument()
    expect(screen.getByText('$71.20')).toBeInTheDocument()
    expect(screen.getByRole('meter', { name: '5-hour limit' })).toHaveAttribute(
      'aria-valuenow',
      '88'
    )
    expect(screen.getByText(/88%, 4[12]m left/)).toBeInTheDocument()
  })

  it('says it in words when the 5-hour limit is nearly spent', () => {
    render(<ResourceBar {...counts} needsYouCount={null} usage={null} rateLimits={rateLimits} />)
    expect(screen.getByText('Near limit')).toBeInTheDocument()
  })
})

describe('GaugeWall', () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, 'api')
  })

  it('opens the Office', () => {
    const openOffice = vi.fn().mockResolvedValue({ success: true })
    window.api = mockApi({ openOffice })
    render(<GaugeWall squads={squads} usage={null} rateLimits={null} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open Office' }))

    expect(openOffice).toHaveBeenCalledOnce()
  })

  it('ranks tokens by project with each share', () => {
    render(<GaugeWall squads={squads} usage={null} rateLimits={null} />)
    const ledger = screen.getByRole('region', { name: 'Tokens by project' })
    const rows = within(ledger).getAllByRole('listitem')
    expect(rows.map((row) => row.textContent)).toEqual([
      expect.stringMatching(/ClaudeWatch.*3M.*75%/),
      expect.stringMatching(/PropApp.*1M.*25%/)
    ])
  })

  it('leaves the project ledger out while no session is counted', () => {
    render(
      <GaugeWall
        squads={buildSquads([instanceFixture()], null, NOW_MS)}
        usage={null}
        rateLimits={null}
      />
    )
    expect(screen.queryByRole('region', { name: 'Tokens by project' })).not.toBeInTheDocument()
  })

  it('shows both limit windows and the weekly target as meters', () => {
    render(<GaugeWall squads={squads} usage={usage} rateLimits={rateLimits} />)
    const limits = screen.getByRole('region', { name: 'Limits' })
    expect(within(limits).getByRole('meter', { name: '5-hour limit' })).toBeInTheDocument()
    expect(within(limits).getByRole('meter', { name: '7-day limit' })).toBeInTheDocument()
    expect(within(limits).getByRole('meter', { name: 'Weekly token target' })).toHaveAttribute(
      'aria-valuenow',
      '82'
    )
  })

  it('offers to set up the sync when the limits are too old and no statusline feeds them', async () => {
    const setupRateLimitSync = vi.fn().mockResolvedValue(true)
    window.api = mockApi({
      isStatuslineConfigured: vi.fn().mockResolvedValue(false),
      setupRateLimitSync
    })
    render(
      <GaugeWall
        squads={squads}
        usage={null}
        rateLimits={{ ...rateLimits, isStale: true, isVeryStale: true }}
      />
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Set up sync' }))

    expect(setupRateLimitSync).toHaveBeenCalledOnce()
    expect(await screen.findByText(/Sync configured/)).toBeInTheDocument()
  })
})
