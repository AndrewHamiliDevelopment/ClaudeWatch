import { join } from 'path'
import { PARSED_OUTPUT_ENV } from '../../shared/ps'
import { createOrcaCli } from '../orca-cli'
import { execFilePromise } from '../platform/exec'
import { AccountLedger } from './account-ledger'
import { readDefaultIdentity, readOrcaIdentities } from './identity'
import { loadLedger, saveLedger } from './ledger-file'
import { listOrcaAccounts } from './orca-accounts'

export { AccountLedger } from './account-ledger'
export { type OfficeAccounts, withAccounts, withoutAccounts } from './office-feed'

interface AccountLedgerPlaces {
  isWatching: boolean
  home: string
  // ClaudeWatch's own data folder, where the ledger is kept.
  userData: string
}

// The ledger wired to the real files: the default login, Orca's identity files and its
// signature-checked command line, and ClaudeWatch's own ledger file.
export function createAccountLedger({
  isWatching,
  home,
  userData
}: AccountLedgerPlaces): AccountLedger {
  const orca = createOrcaCli((program, args, options) =>
    execFilePromise(program, args, { ...options, env: PARSED_OUTPUT_ENV })
  )
  const orcaData = join(home, 'Library', 'Application Support', 'orca')
  const ledgerFile = join(userData, 'accounts-ledger.json')
  return new AccountLedger({
    isWatching,
    readDefaultIdentity: () => readDefaultIdentity(home),
    readOrcaIdentities: () => readOrcaIdentities(orcaData),
    listOrcaAccounts: () => listOrcaAccounts(orca.exec),
    load: () => loadLedger(ledgerFile),
    save: (state) => saveLedger(ledgerFile, state)
  })
}
