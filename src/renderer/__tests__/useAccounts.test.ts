import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { AccountsState } from '../../shared/accounts'
import {
  accountsFixture,
  brassHarbor,
  lanternWorks
} from '../components/accounts/__tests__/fixtures'
import { useAccounts } from '../hooks/useAccounts'
import { mockApi } from './api-mock'

const watched = accountsFixture({ accounts: [lanternWorks] })

describe('useAccounts', () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, 'api')
  })

  it('is loading until the first read answers', () => {
    window.api = mockApi({ getAccounts: vi.fn(() => new Promise<AccountsState>(() => undefined)) })
    const { result } = renderHook(() => useAccounts())
    expect(result.current.accounts.status).toBe('loading')
  })

  it('reports accounts that are not being watched as off', async () => {
    window.api = mockApi({ getAccounts: vi.fn().mockResolvedValue({ status: 'off' }) })
    const { result } = renderHook(() => useAccounts())
    await waitFor(() => expect(result.current.accounts.status).toBe('off'))
  })

  it('reads the accounts, then follows every update main sends', async () => {
    let push: (state: AccountsState) => void = () => undefined
    const unsubscribe = vi.fn()
    window.api = mockApi({
      getAccounts: vi.fn().mockResolvedValue(watched),
      onAccountsUpdate: vi.fn((listener: (state: AccountsState) => void) => {
        push = listener
        return unsubscribe
      })
    })
    const { result, unmount } = renderHook(() => useAccounts())
    await waitFor(() => expect(result.current.accounts).toEqual(watched))

    const next = accountsFixture({ accounts: [lanternWorks, brassHarbor] })
    act(() => push(next))
    expect(result.current.accounts).toEqual(next)

    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('keeps an update that arrives before the first read answers', async () => {
    let push: (state: AccountsState) => void = () => undefined
    let answerRead: (state: AccountsState) => void = () => undefined
    window.api = mockApi({
      getAccounts: vi.fn(() => new Promise<AccountsState>((resolve) => (answerRead = resolve))),
      onAccountsUpdate: vi.fn((listener: (state: AccountsState) => void) => {
        push = listener
        return () => undefined
      })
    })
    const { result } = renderHook(() => useAccounts())
    const newer = accountsFixture({ accounts: [lanternWorks, brassHarbor] })

    act(() => push(newer))
    await act(async () => answerRead(watched))

    expect(result.current.accounts).toEqual(newer)
  })

  it('reports a failed read as an error, and recovers on reload', async () => {
    const getAccounts = vi.fn().mockRejectedValueOnce(new Error('ipc')).mockResolvedValue(watched)
    window.api = mockApi({ getAccounts })
    const { result } = renderHook(() => useAccounts())
    await waitFor(() => expect(result.current.accounts.status).toBe('error'))

    act(() => result.current.reload())
    await waitFor(() => expect(result.current.accounts).toEqual(watched))
  })

  it('is an error where the app shell offers no accounts', async () => {
    const { result } = renderHook(() => useAccounts())
    await waitFor(() => expect(result.current.accounts.status).toBe('error'))
  })

  it('hands a rename to main and returns its answer', async () => {
    const setAccountAlias = vi.fn().mockResolvedValue({ success: false, reason: 'invalid-alias' })
    window.api = mockApi({ getAccounts: vi.fn().mockResolvedValue(watched), setAccountAlias })
    const { result } = renderHook(() => useAccounts())
    await waitFor(() => expect(result.current.accounts.status).toBe('on'))

    await expect(result.current.setAlias(lanternWorks.key, 'Work')).resolves.toEqual({
      success: false,
      reason: 'invalid-alias'
    })
    expect(setAccountAlias).toHaveBeenCalledWith(lanternWorks.key, 'Work')
  })

  it('answers a rename that never reached main as a failure', async () => {
    window.api = mockApi({
      getAccounts: vi.fn().mockResolvedValue(watched),
      setAccountAlias: vi.fn().mockRejectedValue(new Error('ipc'))
    })
    const { result } = renderHook(() => useAccounts())
    await waitFor(() => expect(result.current.accounts.status).toBe('on'))
    await expect(result.current.setAlias(lanternWorks.key, 'Work')).resolves.toEqual({
      success: false
    })
  })
})
