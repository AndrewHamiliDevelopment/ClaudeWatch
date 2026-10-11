import type { FeedMessage, OfficeSnapshot } from '../../shared/office/types'
import type { AccountLedger } from './account-ledger'
import { decorateSession, decorateSnapshot } from './accounts-view'

interface FeedSource {
  snapshot(): OfficeSnapshot | null
  onMessage(listener: (message: FeedMessage) => void): () => void
}

export type OfficeAccounts = Pick<AccountLedger, 'decorate' | 'decorateSession' | 'onOfficeChange'>

// For a host with no ledger behind it: every session leaves without an account, exactly as
// when accounts are not watched.
export const withoutAccounts = (host: FeedSource): FeedSource =>
  withAccounts(host, {
    decorate: (snapshot) => decorateSnapshot(null, snapshot),
    decorateSession: (session) => decorateSession(null, session),
    onOfficeChange: () => () => {}
  })

// The bridge knows sessions and main knows accounts: this is the bridge's feed with each
// session's account, and the list of accounts, added on the way to the Office and dashboard.
export function withAccounts(host: FeedSource, accounts: OfficeAccounts): FeedSource {
  const snapshot = (): OfficeSnapshot | null => {
    const current = host.snapshot()
    return current && accounts.decorate(current)
  }
  return {
    snapshot,
    onMessage: (listener) => {
      const offFeed = host.onMessage((message) => {
        if (message.type === 'hello') {
          listener({ ...message, snapshot: accounts.decorate(message.snapshot) })
        } else if (message.type === 'patch') {
          listener({ ...message, upserts: message.upserts.map(accounts.decorateSession) })
        } else listener(message)
      })
      // A patch has no place for the account list, so a change to it goes out as a hello.
      const offAccounts = accounts.onOfficeChange(() => {
        const current = snapshot()
        if (current) listener({ type: 'hello', v: 1, snapshot: current })
      })
      return () => {
        offFeed()
        offAccounts()
      }
    }
  }
}
