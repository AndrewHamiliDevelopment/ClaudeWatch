import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { PopoverView } from '../components/PopoverView'
import type { InstanceUpdate, RateLimits } from '../lib/types'
import { mockApi } from './api-mock'
import { instanceFixture, NOW_MS, sessionFixture } from './fixtures'

const update: InstanceUpdate = {
  instances: [
    instanceFixture({ pid: 1234, status: 'idle' }),
    instanceFixture({ pid: 2 }),
    instanceFixture({ pid: 3 }),
    instanceFixture({ pid: 4, projectPath: '/w/PropApp', projectName: 'w/PropApp', status: 'idle' })
  ],
  stats: { total: 4, active: 2, idle: 2, stale: 0, exited: 0, recentlyCompleted: 0 }
}

const snapshot = {
  rev: 1,
  generatedAtMs: NOW_MS,
  sessions: [sessionFixture({ pid: 1234, name: 'token ledger', attention: 'permission' as const })],
  sources: []
}

const rateLimits: RateLimits = {
  window_5h: { used_percentage: 88, resets_at: null },
  window_7d: { used_percentage: 57, resets_at: null },
  updated_at: new Date().toISOString(),
  dataAvailable: true,
  isStale: false,
  isVeryStale: false
}

function apiWith(overrides: Parameters<typeof mockApi>[0] = {}) {
  return mockApi({
    getInstances: vi.fn().mockResolvedValue(update),
    getPopoverPinned: vi.fn().mockResolvedValue(false),
    ...overrides
  })
}

describe('PopoverView', () => {
  beforeEach(() => {
    window.api = apiWith({ getOfficeSnapshot: vi.fn().mockResolvedValue(snapshot) })
  })

  it('tallies who needs you, who works and who rests, in words', async () => {
    render(<PopoverView />)
    const tally = await screen.findByRole('status', { name: 'Agents' })
    expect(tally).toHaveTextContent('1 needs you')
    expect(tally).toHaveTextContent('2 working')
    expect(tally).toHaveTextContent('1 at rest')
  })

  it('puts the work order first, with the same name, reason and action as the dashboard', async () => {
    const focusSession = vi.fn().mockResolvedValue({ success: true, target: 'pane' })
    window.api = apiWith({ getOfficeSnapshot: vi.fn().mockResolvedValue(snapshot), focusSession })
    render(<PopoverView />)

    const review = await screen.findByRole('button', { name: 'Review token ledger' })
    expect(screen.getByText('Needs permission')).toBeInTheDocument()
    const squads = screen.getByRole('list', { name: 'Squads' })
    expect(review.compareDocumentPosition(squads) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()

    fireEvent.click(review)
    expect(focusSession).toHaveBeenCalledWith(1234)
  })

  it('gives each squad a row whose pips are spelled out for a screen reader', async () => {
    render(<PopoverView />)
    const squads = await screen.findByRole('list', { name: 'Squads' })
    const rows = within(squads).getAllByRole('listitem')

    expect(rows[0]).toHaveTextContent('ClaudeWatch')
    expect(within(rows[0]).getByText('1 needs you, 2 working')).toBeInTheDocument()
    expect(rows[1]).toHaveTextContent('PropApp')
    expect(within(rows[1]).getByText('1 at rest')).toBeInTheDocument()
  })

  it('shows no slips and no needs-you tally without the office feed', async () => {
    window.api = apiWith()
    render(<PopoverView />)
    const tally = await screen.findByRole('status', { name: 'Agents' })
    await screen.findByText('2 working')

    expect(tally).not.toHaveTextContent('need')
    expect(screen.queryByRole('button', { name: /Review/ })).not.toBeInTheDocument()
  })

  it('prints both limit windows beside their meters', async () => {
    window.api = apiWith({ getRateLimits: vi.fn().mockResolvedValue(rateLimits) })
    render(<PopoverView />)

    expect(await screen.findByRole('meter', { name: '5-hour limit' })).toHaveAttribute(
      'aria-valuenow',
      '88'
    )
    expect(screen.getByRole('meter', { name: '7-day limit' })).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
  })

  it('opens the Office, the dashboard, and quits', async () => {
    const openOffice = vi.fn().mockResolvedValue({ success: true })
    const openDashboard = vi.fn().mockResolvedValue({ success: true })
    const quit = vi.fn().mockResolvedValue(undefined)
    window.api = apiWith({ openOffice, openDashboard, quit })
    render(<PopoverView />)
    await screen.findByRole('list', { name: 'Squads' })

    fireEvent.click(screen.getByRole('button', { name: 'Open Office' }))
    fireEvent.click(screen.getByRole('button', { name: 'Dashboard' }))
    fireEvent.click(screen.getByRole('button', { name: 'Quit ClaudeWatch' }))

    expect(openOffice).toHaveBeenCalledOnce()
    expect(openDashboard).toHaveBeenCalledOnce()
    expect(quit).toHaveBeenCalledOnce()
  })

  it('pins and closes from the header', async () => {
    const setPopoverPinned = vi.fn().mockResolvedValue({ success: true })
    const closePopover = vi.fn().mockResolvedValue({ success: true })
    window.api = apiWith({ setPopoverPinned, closePopover })
    render(<PopoverView />)

    fireEvent.click(await screen.findByRole('button', { name: 'Pin window' }))
    fireEvent.click(screen.getByRole('button', { name: 'Close popover' }))

    expect(setPopoverPinned).toHaveBeenCalledWith(true)
    expect(closePopover).toHaveBeenCalledOnce()
  })

  it('never renders an object where a class name belongs', async () => {
    const { container } = render(<PopoverView />)
    await screen.findByRole('list', { name: 'Squads' })
    expect(container.innerHTML).not.toContain('[object Object]')
  })
})
