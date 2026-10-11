import { screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { agentTable, officesPanel, resetHud, selectAgent, setupHud } from './hud-test-harness'

vi.mock('../webgl-support', () => ({ canCreateWebGL2: () => false }))

beforeEach(resetHud)

function fact(inspector: HTMLElement, term: string): Element | null {
  return within(inspector).getByText(term, { selector: 'dt' }).nextElementSibling
}

describe('tokens in the HUD', () => {
  it('shows the office total and agent count on the resource bar', () => {
    setupHud()
    const totals = screen.getByRole('region', { name: 'Office totals' })
    expect(totals).toHaveTextContent('5 agents')
    expect(totals).toHaveTextContent('157 tokens')
  })

  it('shows tokens beside the agent count for the office, each company and each project', () => {
    setupHud()
    const offices = officesPanel()
    expect(within(offices).getByText('All offices').closest('li')).toHaveTextContent(
      /5 agents.*157/
    )
    expect(
      within(offices).getByRole('button', { name: 'ZKidz, 5 agents, 1 needs you, 157 tokens' })
    ).toBeInTheDocument()
    expect(
      within(offices).getByRole('button', {
        name: 'ClaudeWatch, 4 agents, 1 needs you, 157 tokens'
      })
    ).toBeInTheDocument()
  })

  it('leaves a project blank while nothing in it has been counted', () => {
    setupHud()
    expect(
      within(officesPanel()).getByRole('button', { name: 'PropApp, 1 agent' })
    ).toBeInTheDocument()
  })

  it('gives the list a Tokens column, with counting in place of an unknown number', () => {
    setupHud()
    const table = agentTable()
    expect(within(table).getByRole('columnheader', { name: 'Tokens' })).toBeInTheDocument()
    const row = (name: string): HTMLElement | null =>
      within(table)
        .getByRole('button', { name: new RegExp(`^${name}`) })
        .closest('tr')
    expect(row('office renderer')).toHaveTextContent('150')
    expect(row('map clustering')).toHaveTextContent('counting…')
    expect(row('lena-hud')).toHaveTextContent('10')
  })

  it('breaks a lead down in the inspector: total, four parts, context, active and spawned', () => {
    setupHud()
    const inspector = selectAgent('office renderer')
    expect(fact(inspector, 'Tokens')).toHaveTextContent('150')
    expect(fact(inspector, 'Input')).toHaveTextContent('51')
    expect(fact(inspector, 'Output')).toHaveTextContent('2')
    expect(fact(inspector, 'Cache write')).toHaveTextContent('3')
    expect(fact(inspector, 'Cache read')).toHaveTextContent('94')
    expect(fact(inspector, 'Context')).toHaveTextContent('225K')
    expect(fact(inspector, 'Subagents')).toHaveTextContent('2 active, 31 spawned')
  })

  it('shows the share of the window where its size is known', () => {
    setupHud()
    const inspector = selectAgent('listing search')
    expect(within(inspector).getByText('136K of 272K, 50%')).toBeInTheDocument()
    expect(within(inspector).getByRole('meter', { name: 'Context window' })).toHaveAttribute(
      'aria-valuenow',
      '50'
    )
  })

  it('says counting, never 0, for a session without usage', () => {
    setupHud()
    const inspector = selectAgent('map clustering')
    expect(fact(inspector, 'Tokens')).toHaveTextContent('counting…')
    expect(within(inspector).queryByText('Input')).not.toBeInTheDocument()
  })

  it('shows a teammate its own tokens', () => {
    setupHud()
    expect(fact(selectAgent('lena-hud'), 'Tokens')).toHaveTextContent('10')
  })
})
