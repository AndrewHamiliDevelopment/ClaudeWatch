import { act, fireEvent, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agentTable, resetHud, selectAgent, setupHud } from './hud-test-harness'

vi.mock('../webgl-support', () => ({ canCreateWebGL2: () => false }))

beforeEach(resetHud)

function focusButton(inspector: HTMLElement): HTMLElement {
  return within(inspector).getByRole('button', { name: /^Focus terminal/ })
}

describe('teammates', () => {
  it('lists a teammate by its own name and marks it as one', () => {
    setupHud()
    const table = agentTable()
    expect(within(table).getByRole('button', { name: /^lena-hud.*teammate/ })).toBeInTheDocument()
    expect(within(table).getByRole('button', { name: /^Explore.*subagent/ })).toBeInTheDocument()
  })

  it('shows whose teammate it is and its agent type', () => {
    setupHud()
    const inspector = selectAgent('lena-hud')
    expect(within(inspector).getByText('Teammate of office renderer')).toBeInTheDocument()
    expect(within(inspector).getByText('lena')).toBeInTheDocument()
  })

  it('focuses, talks to and peeks at the teammate itself', async () => {
    const { focus, send, peek } = setupHud()
    const inspector = selectAgent('lena-hud')
    fireEvent.click(focusButton(inspector))
    expect(focus).toHaveBeenCalledWith('claude:a#t1')
    fireEvent.change(within(inspector).getByRole('textbox', { name: 'Message lena-hud' }), {
      target: { value: 'ship it' }
    })
    await act(async () => {
      fireEvent.click(within(inspector).getByRole('button', { name: 'Send' }))
    })
    expect(send).toHaveBeenCalledWith('claude:a#t1', 'ship it')
    await act(async () => {
      fireEvent.click(within(inspector).getByRole('button', { name: 'Peek at screen' }))
    })
    expect(peek).toHaveBeenCalledWith('claude:a#t1')
  })

  it('keeps a subagent on its lead: focus and talk go to the parent session', () => {
    const { focus } = setupHud()
    const inspector = selectAgent('Explore')
    expect(within(inspector).getByText('Subagent of office renderer')).toBeInTheDocument()
    fireEvent.click(focusButton(inspector))
    expect(focus).toHaveBeenCalledWith('claude:a')
    expect(
      within(inspector).getByRole('textbox', { name: 'Message office renderer' })
    ).toBeInTheDocument()
  })
})

describe('a view-only page', () => {
  it('says the page is view-only when the bridge refuses a message', async () => {
    const { send } = setupHud()
    send.mockResolvedValue({ success: false, reason: 'not-permitted' })
    const inspector = selectAgent('office renderer')
    fireEvent.change(within(inspector).getByRole('textbox', { name: 'Message office renderer' }), {
      target: { value: 'ship it' }
    })
    await act(async () => {
      fireEvent.click(within(inspector).getByRole('button', { name: 'Send' }))
    })
    expect(
      within(inspector).getByText(
        'This page is view-only. Start it with --interactive to act on agents.'
      )
    ).toBeInTheDocument()
  })
})

describe('focus terminal', () => {
  it('is offered on a list row', () => {
    const { focus } = setupHud()
    fireEvent.click(screen.getByRole('button', { name: 'Focus terminal for map clustering' }))
    expect(focus).toHaveBeenCalledWith('codex:b')
  })

  it('is the action on a queue item that cannot be answered from the office', () => {
    const { focus } = setupHud()
    const queue = screen.getByRole('region', { name: 'Needs you' })
    fireEvent.click(within(queue).getByRole('button', { name: 'Answer listing search' }))
    expect(focus).toHaveBeenCalledWith('claude:c')
  })

  it('answers F for the selected agent and ignores it when nothing is selected', () => {
    const { focus } = setupHud()
    fireEvent.keyDown(window, { key: 'f' })
    expect(focus).not.toHaveBeenCalled()
    selectAgent('office renderer')
    fireEvent.keyDown(window, { key: 'f' })
    expect(focus).toHaveBeenCalledWith('claude:a')
  })

  it('says plainly when only Orca could be raised, and lets the notice be dismissed', async () => {
    setupHud({ success: false, target: 'app', reason: 'terminal-not-found' })
    const inspector = selectAgent('office renderer')
    await act(async () => {
      fireEvent.click(focusButton(inspector))
    })
    expect(screen.getByText(/Orca is in front, but not on this agent's pane\./)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }))
    expect(screen.queryByText(/Orca is in front/)).not.toBeInTheDocument()
  })

  it('stays quiet when the agent pane itself came forward', async () => {
    setupHud()
    const inspector = selectAgent('office renderer')
    await act(async () => {
      fireEvent.click(focusButton(inspector))
    })
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument()
  })

  it('repeats the reason, the wait and the action in the inspector of a waiting agent', () => {
    const { focus } = setupHud()
    const inspector = selectAgent('listing search')
    const order = within(inspector).getByRole('region', { name: 'Waiting for you' })
    expect(order).toHaveTextContent('waiting 1:05')
    fireEvent.click(within(order).getByRole('button', { name: 'Answer listing search' }))
    expect(focus).toHaveBeenCalledWith('claude:c')
  })
})
