import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { OfficeApp } from '../OfficeApp'
import type { OfficeFeed, OfficeFrame } from '../scene-model'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession } from './fixtures'

// jsdom has no WebGL, so the app must fall back to the List view on its own.
vi.mock('../webgl-support', () => ({ canCreateWebGL2: () => false }))

function controllableFeed() {
  let push: (frame: OfficeFrame) => void = () => undefined
  const feed: OfficeFeed = {
    subscribe: (listener) => {
      push = listener
      return () => undefined
    },
    jump: vi.fn(),
    send: vi.fn().mockResolvedValue({ success: true }),
    respond: vi.fn().mockResolvedValue({ success: true }),
    peek: vi.fn().mockResolvedValue({ success: true, lines: [] }),
    start: vi.fn().mockResolvedValue({ success: true })
  }
  return { feed, push: (frame: OfficeFrame) => act(() => push(frame)) }
}

const NOW = 1_000_000

const busyFrame = makeFrame({
  floors: [
    makeFloor({
      floorId: 'f1',
      label: 'ClaudeWatch',
      rooms: [makeRoom({ id: 'r1', sessionKey: 'claude:a', label: 'office renderer' })]
    }),
    makeFloor({
      floorId: 'f2',
      label: 'PropApp',
      rooms: [makeRoom({ id: 'r2', sessionKey: 'claude:b', label: 'listing search' })]
    })
  ],
  sessions: [
    makeSession({
      key: 'claude:a',
      name: 'office renderer',
      projectLabel: 'ClaudeWatch',
      activity: 'editing',
      currentTool: { name: 'Edit', category: 'edit' },
      subagents: [{ id: 's1', type: 'Explore', activity: 'reading' }],
      startedAtMs: NOW - 125_000
    }),
    makeSession({
      key: 'claude:b',
      name: 'listing search',
      projectLabel: 'PropApp',
      attention: 'permission',
      updatedAtMs: NOW - 5000
    })
  ],
  agents: [
    makeAgent({
      agentKey: 'a',
      floorId: 'f1',
      roomId: 'r1',
      label: 'office renderer',
      activity: 'editing'
    }),
    makeAgent({
      agentKey: 'a/s1',
      floorId: 'f1',
      roomId: 'r1',
      label: 'Explore',
      isSubagent: true
    }),
    makeAgent({
      agentKey: 'b',
      floorId: 'f2',
      roomId: 'r2',
      label: 'listing search',
      attention: 'permission'
    })
  ]
})

describe('OfficeApp', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => vi.useRealTimers())

  it('shows the empty state when no agents are running', () => {
    const { feed, push } = controllableFeed()
    render(<OfficeApp feed={feed} />)
    push(makeFrame())
    expect(screen.getByRole('heading', { name: 'No agents running' })).toBeInTheDocument()
  })

  it('falls back to the List view when WebGL is unavailable and says so', () => {
    const { feed, push } = controllableFeed()
    render(<OfficeApp feed={feed} />)
    push(busyFrame)
    expect(screen.getByText(/3D view is unavailable/i)).toBeInTheDocument()
    const table = screen.getByRole('table', { name: /agents by floor and room/i })
    expect(within(table).getByRole('button', { name: /office renderer/i })).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: /Explore/ })).toBeInTheDocument()
  })

  it('lists waiting sessions in the attention queue and announces them', () => {
    const { feed, push } = controllableFeed()
    render(<OfficeApp feed={feed} />)
    push(busyFrame)
    const queue = screen.getByRole('region', { name: 'Needs you' })
    expect(
      within(queue).getByRole('button', { name: /listing search.*needs permission/i })
    ).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(
      /needs permission: PropApp › listing search/i
    )
  })

  it('switches floors from the elevator panel', () => {
    const { feed, push } = controllableFeed()
    render(<OfficeApp feed={feed} />)
    push(busyFrame)
    const elevator = screen.getByRole('navigation', { name: 'Floors' })
    const claudeWatch = within(elevator).getByRole('button', {
      name: /floor 1, ClaudeWatch, 2 agents/i
    })
    fireEvent.click(claudeWatch)
    expect(claudeWatch).toHaveAttribute('aria-current', 'true')
  })

  it('opens the inspector for a selected agent and jumps to its terminal', () => {
    const { feed, push } = controllableFeed()
    render(<OfficeApp feed={feed} />)
    push(busyFrame)
    fireEvent.click(screen.getByRole('button', { name: /^office renderer/i }))
    const inspector = screen.getByRole('complementary', { name: 'Agent details' })
    expect(within(inspector).getByText('ClaudeWatch')).toBeInTheDocument()
    expect(within(inspector).getByText('Claude')).toBeInTheDocument()
    expect(within(inspector).getByText('Edit')).toBeInTheDocument()
    expect(within(inspector).getByText('2:05')).toBeInTheDocument()
    expect(within(inspector).getByText('1')).toBeInTheDocument()
    fireEvent.click(within(inspector).getByRole('button', { name: 'Jump to terminal' }))
    expect(feed.jump).toHaveBeenCalledWith('claude:a')
  })

  it('works from the keyboard: N opens the next waiting session', () => {
    const { feed, push } = controllableFeed()
    render(<OfficeApp feed={feed} />)
    push(busyFrame)
    fireEvent.keyDown(window, { key: 'n' })
    const inspector = screen.getByRole('complementary', { name: 'Agent details' })
    expect(within(inspector).getByRole('heading', { name: 'listing search' })).toBeInTheDocument()
  })

  it('exposes the walls modes as pressed-state buttons', () => {
    const { feed, push } = controllableFeed()
    render(<OfficeApp feed={feed} />)
    push(busyFrame)
    const cutaway = screen.getByRole('button', { name: /cutaway/i })
    fireEvent.keyDown(window, { key: 'w' })
    expect(cutaway).toHaveAttribute('aria-pressed', 'true')
    fireEvent.keyDown(window, { key: 'End' })
    expect(screen.getByRole('button', { name: /walls down/i })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
  })
})
