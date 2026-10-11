import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, screen } from '@testing-library/react'
import type { AccountsState } from '../../../../shared/accounts'
import {
  accountsFixture,
  brassHarbor,
  counts,
  lanternWorks,
  TRACKING_SINCE_MS,
  windowsFixture
} from './fixtures'
import { findCard, freezeClock, showAccounts } from './harness'

const watched = accountsFixture({ accounts: [lanternWorks, brassHarbor] })

beforeEach(freezeClock)

describe('the Accounts screen before it has accounts', () => {
  it('says it is loading until the first read answers', () => {
    showAccounts(watched, { getAccounts: vi.fn(() => new Promise<AccountsState>(() => undefined)) })
    expect(screen.getByRole('status')).toHaveTextContent('Loading accounts…')
  })

  it('says accounts are not watched and turns watching on from there', async () => {
    const getAccounts = vi.fn().mockResolvedValueOnce({ status: 'off' }).mockResolvedValue(watched)
    const setSettings = vi.fn().mockResolvedValue({})
    showAccounts({ status: 'off' }, { getAccounts, setSettings })

    expect(await screen.findByText('Accounts are not being watched.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Watch accounts' }))

    expect(setSettings).toHaveBeenCalledWith({ watchAccounts: true })
    expect(await findCard('Brass Harbor')).toBeInTheDocument()
  })

  it('says so when watching could not be turned on', async () => {
    const setSettings = vi.fn().mockRejectedValue(new Error('ipc'))
    showAccounts({ status: 'off' }, { setSettings })

    fireEvent.click(await screen.findByRole('button', { name: 'Watch accounts' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Watching could not be turned on. Try again.'
    )
    expect(screen.getByRole('button', { name: 'Watch accounts' })).toBeEnabled()
  })

  it('says a failed read failed, and reads again on request', async () => {
    const getAccounts = vi.fn().mockRejectedValueOnce(new Error('ipc')).mockResolvedValue(watched)
    showAccounts(watched, { getAccounts })

    expect(await screen.findByRole('alert')).toHaveTextContent('Accounts could not be read.')
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await findCard('Brass Harbor')).toBeInTheDocument()
  })

  it('says so when watching has not seen an account yet', async () => {
    showAccounts(accountsFixture())
    expect(await screen.findByText('No account has been seen yet.')).toBeInTheDocument()
  })
})

describe('the Accounts screen with accounts', () => {
  it('lists the signed-in account first and marks it in words', async () => {
    showAccounts(watched)
    expect(await findCard('Brass Harbor')).toHaveTextContent('Signed in now')
    expect(await findCard('Lantern Works')).not.toHaveTextContent('Signed in now')
    const names = screen
      .getAllByRole('article')
      .map((article) => article.getAttribute('aria-label'))
    expect(names).toEqual(['Brass Harbor', 'Lantern Works'])
  })

  it('states unattributed usage in one line', async () => {
    const unattributed = {
      usage: windowsFixture(counts(300), counts(1_200), counts(4_000)),
      projects: []
    }
    showAccounts(accountsFixture({ accounts: [brassHarbor], unattributed }))
    expect(await screen.findByText(/Not attributed to any account/)).toHaveTextContent(
      'Not attributed to any account: 300 today, 1.2K in the last 7 days, 4K since tracking began.'
    )
  })

  it('says how the tokens are counted and since when', async () => {
    showAccounts(watched)
    const since = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
      TRACKING_SINCE_MS
    )
    const note = await screen.findByRole('region', { name: 'How this is counted' })
    expect(note).toHaveTextContent(`counted on this Mac since ${since}`)
    expect(note).toHaveTextContent('by which account was signed in at the time')
    expect(note).toHaveTextContent('Exact')
    expect(note).toHaveTextContent('Inferred')
  })
})
