import { useCallback, useEffect, useState } from 'react'
import type { AccountsState, AliasResult } from '../../shared/accounts'
import { deckApi } from '../deck/deck-api'

// 'off' is the owner's choice; 'loading' and 'error' are about the read itself.
export type AccountsLoad = AccountsState | { status: 'loading' } | { status: 'error' }

interface UseAccounts {
  accounts: AccountsLoad
  setAlias: (key: string, alias: string | null) => Promise<AliasResult>
  reload: () => void
}

export function useAccounts(): UseAccounts {
  const [accounts, setAccounts] = useState<AccountsLoad>({ status: 'loading' })
  const [readCount, setReadCount] = useState(0)

  useEffect(() => {
    const api = deckApi()
    let isMounted = true
    let hasUpdate = false
    // An update is newer than a read that was already on its way, so the read never replaces it.
    const showRead = (next: AccountsLoad): void => {
      if (isMounted && !hasUpdate) setAccounts(next)
    }
    // Main pushes every change (tokens, names, who is signed in), so one read is enough.
    Promise.resolve(api?.getAccounts())
      .then((state) => showRead(state ?? { status: 'error' }))
      .catch(() => showRead({ status: 'error' }))
    const unsubscribe = api?.onAccountsUpdate((state) => {
      hasUpdate = true
      if (isMounted) setAccounts(state)
    })
    return () => {
      isMounted = false
      unsubscribe?.()
    }
  }, [readCount])

  const reload = useCallback(() => setReadCount((count) => count + 1), [])

  const setAlias = useCallback(async (key: string, alias: string | null): Promise<AliasResult> => {
    try {
      return (await deckApi()?.setAccountAlias(key, alias)) ?? { success: false }
    } catch {
      // The reason is main's to give; without one the caller reports a plain failure.
      return { success: false }
    }
  }, [])

  return { accounts, setAlias, reload }
}
