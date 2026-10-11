import { render, screen, within } from '@testing-library/react'
import { vi } from 'vitest'
import type { AccountsState } from '../../../../shared/accounts'
import { mockApi } from '../../../__tests__/api-mock'
import { AccountsView } from '../AccountsView'
import { NOW_MS } from './fixtures'

export function showAccounts(
  state: AccountsState,
  overrides: Parameters<typeof mockApi>[0] = {}
): void {
  window.api = mockApi({ getAccounts: vi.fn().mockResolvedValue(state), ...overrides })
  render(<AccountsView />)
}

export async function findCard(name: string): Promise<HTMLElement> {
  return screen.findByRole('article', { name })
}

export function cellTexts(table: HTMLElement, rowName: string): (string | null)[] {
  const header = within(table).getByRole('rowheader', { name: rowName, hidden: true })
  if (!header.parentElement) throw new Error(`no row for ${rowName}`)
  return within(header.parentElement)
    .getAllByRole('cell', { hidden: true })
    .map((cell) => cell.textContent)
}

// Ages are read against the clock, so every test starts at the fixtures' noon.
export function freezeClock(): () => void {
  vi.useFakeTimers({ toFake: ['Date'] })
  vi.setSystemTime(NOW_MS)
  return () => vi.useRealTimers()
}
