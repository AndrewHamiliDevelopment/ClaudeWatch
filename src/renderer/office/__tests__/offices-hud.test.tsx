import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { InteractionResult } from '../../../shared/office/types'
import { OfficeApp } from '../OfficeApp'
import type { OfficeFeed, OfficeFrame } from '../scene-model'
import { makeAgent, makeFloor, makeFrame, makeRoom, makeSession, makeZone } from './fixtures'

vi.mock('../webgl-support', () => ({ canCreateWebGL2: () => false }))

function harness() {
  let push: (frame: OfficeFrame) => void = () => undefined
  const feed: OfficeFeed = {
    subscribe: (listener) => {
      push = listener
      return () => undefined
    },
    jump: vi.fn(),
    send: vi.fn(async (): Promise<InteractionResult> => ({ success: true })),
    respond: vi.fn(async (): Promise<InteractionResult> => ({ success: true })),
    peek: vi.fn(async () => ({ success: true, lines: [] })),
    start: vi.fn(async (): Promise<InteractionResult> => ({ success: true }))
  }
  render(<OfficeApp feed={feed} />)
  return { feed, push: (frame: OfficeFrame) => act(() => push(frame)) }
}

const companyFrame = makeFrame({
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
            makeZone({
              id: 'p-cw',
              kind: 'project',
              label: 'ClaudeWatch',
              companyKey: 'c_zk',
              projectKey: 'p_cw'
            }),
            makeZone({
              id: 'p-pa',
              kind: 'project',
              label: 'PropApp',
              companyKey: 'c_zk',
              projectKey: 'p_pa'
            })
          ]
        })
      ],
      rooms: [
        makeRoom({ id: 'o-a', sessionKey: 'claude:a', label: 'office renderer' }),
        makeRoom({ id: 'o-b', sessionKey: 'claude:b', label: 'listing search' })
      ]
    })
  ],
  sessions: [
    makeSession({
      key: 'claude:a',
      name: 'office renderer',
      projectKey: 'p_cw',
      projectLabel: 'ClaudeWatch',
      companyKey: 'c_zk',
      companyLabel: 'ZKidz'
    }),
    makeSession({
      key: 'claude:b',
      name: 'listing search',
      projectKey: 'p_pa',
      projectLabel: 'PropApp',
      companyKey: 'c_zk',
      companyLabel: 'ZKidz',
      attention: 'permission'
    })
  ],
  agents: [
    makeAgent({ agentKey: 'a', floorId: 'one', roomId: 'o-a', label: 'office renderer' }),
    makeAgent({
      agentKey: 'a/s',
      floorId: 'one',
      roomId: 'o-a',
      label: 'Explore',
      isSubagent: true
    }),
    makeAgent({
      agentKey: 'b',
      floorId: 'one',
      roomId: 'o-b',
      label: 'listing search',
      attention: 'permission'
    })
  ]
})

describe('Offices panel', () => {
  it('shows Company › Project with agent and attention counts', () => {
    const { push } = harness()
    push(companyFrame)
    const offices = screen.getByRole('navigation', { name: 'Offices' })
    expect(
      within(offices).getByRole('button', { name: 'ZKidz, 3 agents, 1 needs you' })
    ).toBeInTheDocument()
    expect(
      within(offices).getByRole('button', { name: 'ClaudeWatch, 2 agents' })
    ).toBeInTheDocument()
    expect(
      within(offices).getByRole('button', { name: 'PropApp, 1 agent, 1 needs you' })
    ).toBeInTheDocument()
  })

  it('flies to a company or project row and marks it current', () => {
    const { push } = harness()
    push(companyFrame)
    const offices = screen.getByRole('navigation', { name: 'Offices' })
    const project = within(offices).getByRole('button', { name: /^ClaudeWatch/ })
    fireEvent.click(project)
    expect(project).toHaveAttribute('aria-current', 'true')
  })

  it('starts a new agent in a project from its row', () => {
    const { feed, push } = harness()
    push(companyFrame)
    const offices = screen.getByRole('navigation', { name: 'Offices' })
    fireEvent.click(within(offices).getByRole('button', { name: 'New agent in PropApp' }))
    fireEvent.click(within(offices).getByRole('button', { name: 'Start Codex agent' }))
    expect(feed.start).toHaveBeenCalledWith('p_pa', 'codex')
  })

  it('no longer switches floors with the bracket keys', () => {
    const { push } = harness()
    push(companyFrame)
    fireEvent.keyDown(window, { key: ']' })
    expect(screen.queryByRole('navigation', { name: 'Floors' })).not.toBeInTheDocument()
  })
})

describe('List view and attention rail', () => {
  it('groups agents Company › Project › Agent', () => {
    const { push } = harness()
    push(companyFrame)
    const table = screen.getByRole('table', { name: /agents by company and project/i })
    expect(within(table).getByRole('rowheader', { name: /ZKidz/ })).toBeInTheDocument()
    expect(within(table).getByRole('rowheader', { name: /ClaudeWatch/ })).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: /Explore/ })).toBeInTheDocument()
  })

  it('shows Project · Company on queue rows', () => {
    const { push } = harness()
    push(companyFrame)
    const queue = screen.getByRole('region', { name: 'Needs you' })
    expect(within(queue).getByText(/PropApp · ZKidz/)).toBeInTheDocument()
  })
})

describe('connecting and source health', () => {
  it('says it is connecting until the first snapshot, not that nothing runs', () => {
    const { push } = harness()
    push(makeFrame({ connected: false }))
    expect(screen.getByText('Connecting to your agents…')).toBeInTheDocument()
    expect(screen.queryByText('No agents running')).not.toBeInTheDocument()
    push(makeFrame({ connected: true }))
    expect(screen.getByText('No agents running')).toBeInTheDocument()
  })

  it('lists failing sources in a non-blocking banner', () => {
    const { push } = harness()
    push({
      ...companyFrame,
      sources: [
        {
          id: 'orca',
          ok: false,
          detail: 'Orca not running: Talk, Peek and Review are off for Orca sessions'
        },
        { id: 'registry', ok: true, detail: 'ok' }
      ]
    })
    const banner = screen.getByRole('region', { name: 'Source health' })
    expect(within(banner).getByText(/Orca not running/)).toBeInTheDocument()
    expect(within(banner).queryByText(/registry/)).not.toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Offices' })).toBeInTheDocument()
  })
})
