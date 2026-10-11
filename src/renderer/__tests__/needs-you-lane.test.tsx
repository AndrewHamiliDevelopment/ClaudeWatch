import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { NeedsYouLane } from '../components/NeedsYouLane'
import { buildWorkOrders } from '../deck/work-orders'
import { mockApi } from './api-mock'
import { sessionFixture } from './fixtures'

const permission = sessionFixture({
  key: 'claude:ledger',
  pid: 4321,
  name: 'token ledger',
  attention: 'permission',
  updatedAtMs: Date.now() - 192_000
})
const question = sessionFixture({
  key: 'claude:search',
  pid: 99,
  name: 'listing search',
  projectLabel: 'PropApp',
  cwd: '/w/PropApp',
  attention: 'question',
  updatedAtMs: Date.now() - 460_000
})

describe('buildWorkOrders', () => {
  it('queues only agents that wait on you, longest wait first', () => {
    const orders = buildWorkOrders([permission, sessionFixture({ key: 'claude:busy' }), question])
    expect(orders.map((order) => order.sessionName)).toEqual(['listing search', 'token ledger'])
  })

  it('carries where to jump for each order', () => {
    const [order] = buildWorkOrders([question])
    expect(order.target).toEqual({ pid: 99, projectPath: '/w/PropApp' })
  })
})

describe('NeedsYouLane', () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, 'api')
  })

  it('renders nothing while it is unknown who waits', () => {
    const { container } = render(<NeedsYouLane orders={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('says so when nothing waits', () => {
    render(<NeedsYouLane orders={[]} />)
    expect(screen.getByRole('heading', { name: 'Needs you' })).toBeInTheDocument()
    expect(screen.getByText('Nothing is waiting on you.')).toBeInTheDocument()
  })

  it('shows a slip with the task, the reason in words, the project and the wait', () => {
    render(<NeedsYouLane orders={buildWorkOrders([permission])} />)

    const slip = screen.getByRole('listitem')
    expect(within(slip).getByText('token ledger')).toBeInTheDocument()
    expect(within(slip).getByText('Needs permission')).toBeInTheDocument()
    expect(within(slip).getByText('ClaudeWatch')).toBeInTheDocument()
    expect(slip).toHaveTextContent('waiting 3:12')
  })

  it('lists the longest wait first', () => {
    render(<NeedsYouLane orders={buildWorkOrders([permission, question])} />)
    const names = screen.getAllByRole('listitem').map((slip) => within(slip).getByRole('heading'))
    expect(names.map((heading) => heading.textContent)).toEqual(['listing search', 'token ledger'])
  })

  it('names the action after the reason and jumps to that agent', () => {
    const focusSession = vi.fn().mockResolvedValue({ success: true, target: 'pane' })
    window.api = mockApi({ focusSession })
    render(<NeedsYouLane orders={buildWorkOrders([permission, question])} />)

    expect(screen.getByRole('button', { name: 'Answer listing search' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Review token ledger' }))

    expect(focusSession).toHaveBeenCalledWith(4321)
  })
})
