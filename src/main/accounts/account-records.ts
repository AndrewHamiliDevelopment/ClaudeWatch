import { accountKey } from '../../bridge/account-key'
import { type AccountSource, type AliasResult, MAX_ALIAS_LENGTH } from '../../shared/accounts'
import type { Identity } from './identity'
import type { AccountRecord, LedgerState } from './ledger-state'
import type { OrcaAccountList } from './orca-accounts'

type AccountDetails = Pick<AccountRecord, 'key' | 'provider'> &
  Partial<Pick<AccountRecord, 'email' | 'organizationUuid' | 'organizationName' | 'plan'>>

// Finds the account by key or adds it, then records what this source knows about it.
export function upsertAccount(
  state: LedgerState,
  details: AccountDetails,
  source: AccountSource,
  now: number
): AccountRecord {
  let record = state.accounts.find((account) => account.key === details.key)
  if (!record) {
    record = {
      key: details.key,
      provider: details.provider,
      email: null,
      organizationUuid: null,
      organizationName: null,
      plan: null,
      alias: null,
      orcaAccountId: null,
      sources: [],
      firstSeenMs: now
    }
    state.accounts.push(record)
  }
  Object.assign(record, details)
  if (!record.sources.includes(source)) record.sources.push(source)
  return record
}

export function upsertClaudeAccount(
  state: LedgerState,
  identity: Identity,
  source: AccountSource,
  now: number
): AccountRecord {
  return upsertAccount(
    state,
    {
      key: accountKey('claude', identity.accountUuid),
      provider: 'claude',
      email: identity.emailAddress,
      organizationUuid: identity.organizationUuid,
      organizationName: identity.organizationName || null,
      plan: identity.organizationRateLimitTier
    },
    source,
    now
  )
}

// Orca's own list has no account id: a row joins a known account by email and organisation
// together. Email alone could merge one person's two organisations into one card.
export function mergeOrcaAccounts(state: LedgerState, list: OrcaAccountList, now: number): void {
  for (const row of list.claude) {
    const record = state.accounts.find(
      (account) =>
        account.provider === 'claude' &&
        account.organizationUuid === row.organizationUuid &&
        account.email?.toLowerCase() === row.email.toLowerCase()
    )
    if (!record) continue
    record.orcaAccountId = row.id
    if (!record.sources.includes('orca')) record.sources.push('orca')
  }
  for (const { orcaAccountId, limits } of list.claudeLimits) {
    const record = state.accounts.find((account) => account.orcaAccountId === orcaAccountId)
    if (record) state.limits.set(record.key, limits)
  }
  state.codexDefaultKey = null
  if (!list.codex) return
  const codex = upsertAccount(
    state,
    {
      key: accountKey('codex', list.codex.providerAccountId),
      provider: 'codex',
      email: list.codex.email,
      organizationName: list.codex.workspaceLabel
    },
    'orca',
    now
  )
  state.codexDefaultKey = codex.key
  state.limits.set(codex.key, list.codex.limits)
}

// Printable characters only: the name is shown in two windows.
const hasControlCharacter = (value: string): boolean =>
  [...value].some((character) => character < ' ' || character === '\u007f')

export function setAlias(state: LedgerState, key: unknown, alias: unknown): AliasResult {
  const record = state.accounts.find((account) => account.key === key)
  if (!record) return { success: false, reason: 'unknown-account' }
  if (alias !== null && typeof alias !== 'string')
    return { success: false, reason: 'invalid-alias' }
  const name = alias?.trim() ?? ''
  if (name.length > MAX_ALIAS_LENGTH || hasControlCharacter(name)) {
    return { success: false, reason: 'invalid-alias' }
  }
  record.alias = name || null
  return { success: true }
}
