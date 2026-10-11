import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { MAX_ALIAS_LENGTH, type AliasResult } from '../../../../shared/accounts'
import {
  accountFixture,
  accountsFixture,
  brassHarbor,
  counts,
  lanternWorks,
  windowsFixture
} from './fixtures'
import { cellTexts, findCard, freezeClock, showAccounts } from './harness'

const watched = accountsFixture({ accounts: [lanternWorks, brassHarbor] })

beforeEach(freezeClock)

describe('an account card', () => {
  it('shows the alias in place of the organisation, with the plan and the address', async () => {
    showAccounts(accountsFixture({ accounts: [{ ...brassHarbor, alias: 'Day job' }] }))
    const dayJob = await findCard('Day job')
    expect(within(dayJob).getByRole('heading', { name: 'Day job' })).toBeInTheDocument()
    expect(dayJob).toHaveTextContent('Max 5x')
    expect(dayJob).toHaveTextContent(brassHarbor.email ?? '')
  })

  it('tells exact tokens from inferred ones for each window', async () => {
    showAccounts(watched)
    const tokens = within(await findCard('Brass Harbor')).getByRole('table', { name: 'Tokens' })
    expect(
      within(tokens)
        .getAllByRole('columnheader')
        .map((header) => header.textContent)
    ).toEqual(['Total', 'Exact', 'Inferred'])
    expect(cellTexts(tokens, 'Today')).toEqual(['2K', '1.5K', '500'])
    expect(cellTexts(tokens, 'Last 7 days')).toEqual(['6K', '4K', '2K'])
    expect(cellTexts(tokens, 'Since tracking began')).toEqual(['12K', '9K', '3K'])
  })

  it('never prints an uncounted window as zero', async () => {
    const uncounted = Object.assign(
      accountFixture({ label: 'Mid count', organizationName: null }),
      { usage: { exact: windowsFixture(counts(5), counts(5), counts(5)) } }
    )
    showAccounts(accountsFixture({ accounts: [uncounted] }))
    const tokens = within(await findCard('Mid count')).getByRole('table', { name: 'Tokens' })
    expect(cellTexts(tokens, 'Today')).toEqual(['counting…', '5', 'counting…'])
  })

  it('keeps the four-part split one step away', async () => {
    showAccounts(watched)
    const brass = await findCard('Brass Harbor')
    expect(within(brass).getByText('Input, output and cache')).toBeInTheDocument()
    const parts = within(brass).getByRole('table', { name: 'Token parts', hidden: true })
    expect(
      within(parts)
        .getAllByRole('columnheader', { hidden: true })
        .map((header) => header.textContent)
    ).toEqual(['Input', 'Output', 'Cache write', 'Cache read'])
    expect(cellTexts(parts, 'Today')).toEqual(['1.2K', '600', '50', '150'])
  })

  it('breaks the tokens down by project', async () => {
    showAccounts(watched)
    const projects = within(await findCard('Brass Harbor')).getByRole('table', { name: 'Projects' })
    expect(cellTexts(projects, 'ClaudeWatch')).toEqual(['1.8K', '5K', '10K'])
    expect(cellTexts(projects, 'PropApp')).toEqual(['200', '1K', '2K'])
    expect(await findCard('Lantern Works')).toHaveTextContent('No project counted yet.')
  })

  it('draws a limit as a named meter with the age of its reading', async () => {
    showAccounts(watched)
    const brass = await findCard('Brass Harbor')
    const meter = within(brass).getByRole('meter', { name: 'Brass Harbor 5-hour limit' })
    expect(meter).toHaveAttribute('aria-valuenow', '42')
    expect(meter).toHaveAttribute('aria-valuetext', '42%, as of 2m ago')
    expect(brass).toHaveTextContent('as of 2m ago')
    expect(brass).not.toHaveTextContent('Old reading')
  })

  it('makes a limit read long ago look old', async () => {
    showAccounts(watched)
    const lantern = await findCard('Lantern Works')
    expect(lantern).toHaveTextContent('Old reading, as of 4h ago')
    expect(
      within(lantern).getByRole('meter', { name: 'Lantern Works 7-day limit' })
    ).toHaveAttribute('aria-valuetext', '71%, old reading, as of 4h ago')
  })

  it('calls a missing limit unknown, never 0%', async () => {
    showAccounts(accountsFixture({ accounts: [accountFixture()] }))
    const lantern = await findCard('Lantern Works')
    expect(lantern).toHaveTextContent('Limits unknown')
    expect(within(lantern).queryByRole('meter')).not.toBeInTheDocument()
    expect(lantern).not.toHaveTextContent('0%')
  })
})

describe('renaming an account', () => {
  const setAccountAlias = vi.fn<(key: string, alias: string | null) => Promise<AliasResult>>()

  async function openRename(): Promise<HTMLInputElement> {
    showAccounts(accountsFixture({ accounts: [{ ...lanternWorks, alias: 'Side' }] }), {
      setAccountAlias
    })
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Side' }))
    return screen.getByRole<HTMLInputElement>('textbox', { name: 'Name for this account' })
  }

  function submit(input: HTMLInputElement, name: string): void {
    fireEvent.change(input, { target: { value: name } })
    if (!input.form) throw new Error('the name field is outside its form')
    fireEvent.submit(input.form)
  }

  beforeEach(() => {
    setAccountAlias.mockReset().mockResolvedValue({ success: true })
  })

  it('opens on the current name, focused and capped at the alias length', async () => {
    const input = await openRename()
    expect(input).toHaveValue('Side')
    expect(input).toHaveFocus()
    expect(input).toHaveAttribute('maxlength', String(MAX_ALIAS_LENGTH))
  })

  it('saves the trimmed name on Enter and hands focus back', async () => {
    submit(await openRename(), '  Night shift ')
    expect(setAccountAlias).toHaveBeenCalledWith(lanternWorks.key, 'Night shift')
    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Rename Side' })).toHaveFocus()
  })

  it('restores the default name when the field is cleared', async () => {
    submit(await openRename(), '   ')
    expect(setAccountAlias).toHaveBeenCalledWith(lanternWorks.key, null)
  })

  it('cancels on Escape without saving', async () => {
    const input = await openRename()
    fireEvent.change(input, { target: { value: 'Other' } })
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(setAccountAlias).not.toHaveBeenCalled()
  })

  it('says why a name was refused and keeps the field open', async () => {
    setAccountAlias.mockResolvedValue({ success: false, reason: 'invalid-alias' })
    const input = await openRename()
    submit(input, 'x')
    expect(await screen.findByRole('alert')).toHaveTextContent('That name cannot be used')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAccessibleDescription(/That name cannot be used/)
  })
})
