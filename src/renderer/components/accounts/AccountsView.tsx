import { useState, type ReactNode } from 'react'
import type { AccountsState } from '../../../shared/accounts'
import { deckApi } from '../../deck/deck-api'
import { useAccounts } from '../../hooks/useAccounts'
import { useNow } from '../../hooks/useNow'
import { tokensText } from '../../office/hud/tokens'
import { BUTTON_PRIMARY_CLASS, BUTTON_QUIET_CLASS, PLATE_TITLE_CLASS } from '../deck/deck-styles'
import { AccountCard } from './AccountCard'
import { orderAccounts, USAGE_WINDOWS, windowTokens } from './account-view'

// Reading ages are printed to the minute.
const AGE_REFRESH_MS = 60_000

type WatchedAccounts = Extract<AccountsState, { status: 'on' }>

export function AccountsView() {
  const { accounts, setAlias, reload } = useAccounts()

  const [hasWatchFailed, setHasWatchFailed] = useState(false)

  const watchAccounts = async (): Promise<void> => {
    try {
      await deckApi()?.setSettings({ watchAccounts: true })
      setHasWatchFailed(false)
      reload()
    } catch {
      setHasWatchFailed(true)
    }
  }

  return (
    <div className="no-drag flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div className="no-drag flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        <h1 className="pt-1 font-plate text-count">Accounts</h1>
        {accounts.status === 'loading' && (
          <p className="py-10 text-center text-body text-text-secondary" role="status">
            Loading accounts…
          </p>
        )}
        {accounts.status === 'error' && (
          <Notice role="alert" message="Accounts could not be read.">
            <button type="button" onClick={reload} className={BUTTON_QUIET_CLASS}>
              Try again
            </button>
          </Notice>
        )}
        {accounts.status === 'off' && (
          <Notice
            role="status"
            message="Accounts are not being watched."
            detail="Watching reads account names, plans and email addresses, kept on this Mac, to count tokens per account. It never reads credentials."
          >
            <button
              type="button"
              onClick={() => void watchAccounts()}
              className={BUTTON_PRIMARY_CLASS}
            >
              Watch accounts
            </button>
            {hasWatchFailed && (
              <p role="alert" className="text-xs font-semibold text-accent-hot">
                Watching could not be turned on. Try again.
              </p>
            )}
          </Notice>
        )}
        {accounts.status === 'on' && <WatchedAccountsList state={accounts} onRename={setAlias} />}
      </div>
    </div>
  )
}

interface NoticeProps {
  role: 'status' | 'alert'
  message: string
  detail?: string
  children: ReactNode
}

function Notice({ role, message, detail, children }: NoticeProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <div role={role}>
        <p className="text-body font-semibold text-text-primary">{message}</p>
        {detail && <p className="mt-1 max-w-prose text-xs text-text-secondary">{detail}</p>}
      </div>
      {children}
    </div>
  )
}

interface WatchedAccountsListProps {
  state: WatchedAccounts
  onRename: ReturnType<typeof useAccounts>['setAlias']
}

function WatchedAccountsList({ state, onRename }: WatchedAccountsListProps) {
  const nowMs = useNow(AGE_REFRESH_MS)
  const trackingSince = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
    state.trackingSinceMs
  )

  return (
    <>
      {state.accounts.length === 0 ? (
        <p className="py-6 text-center text-body text-text-secondary" role="status">
          No account has been seen yet.
        </p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(380px,1fr))] items-start gap-3">
          {orderAccounts(state.accounts).map((account) => (
            <li key={account.key}>
              <AccountCard
                account={account}
                nowMs={nowMs}
                onRename={(alias) => onRename(account.key, alias)}
              />
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-text-secondary">
        Not attributed to any account: {unattributedText(state.unattributed.usage)}. These tokens
        were spent while the signed-in account was not known.
      </p>

      <section aria-labelledby="counting-heading" className="max-w-prose pb-2">
        <h2 id="counting-heading" className={PLATE_TITLE_CLASS}>
          How this is counted
        </h2>
        <p className="mt-1 text-xs text-text-secondary">
          Tokens are counted on this Mac since {trackingSince}, by which account was signed in at
          the time. Exact tokens come from sessions that name their account. Inferred tokens are
          filed under whoever was signed in when they were spent. Use on claude.ai or on another
          computer is not counted here, so these totals will not match a limit’s percentage.
        </p>
      </section>
    </>
  )
}

type UnattributedUsage = WatchedAccounts['unattributed']['usage']

const WINDOW_PHRASE: Record<keyof UnattributedUsage, string> = {
  today: 'today',
  last7Days: 'in the last 7 days',
  sinceTracking: 'since tracking began'
}

function unattributedText(usage: UnattributedUsage): string {
  return USAGE_WINDOWS.map(
    ({ key }) => `${tokensText(windowTokens(usage, key))} ${WINDOW_PHRASE[key]}`
  ).join(', ')
}
