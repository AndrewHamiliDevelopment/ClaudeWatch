import type { AccountsState, AliasResult, UsageDelta } from '../../shared/accounts'
import type { OfficeSnapshot, SessionRef } from '../../shared/office/types'
import { mergeOrcaAccounts, setAlias, upsertClaudeAccount } from './account-records'
import { decorateSession, decorateSnapshot, officeAccounts, toAccountsState } from './accounts-view'
import { countCodexSessions, countUsage, prune, recordIdentity, toUsageDeltas } from './attribution'
import type { Identity, IdentityRead } from './identity'
import { dayKey, emptyLedger, type LedgerState } from './ledger-state'
import type { OrcaAccountList } from './orca-accounts'

export interface AccountLedgerOptions {
  isWatching: boolean
  readDefaultIdentity: () => Promise<IdentityRead>
  readOrcaIdentities: () => Promise<Identity[]>
  listOrcaAccounts: () => Promise<OrcaAccountList | null>
  load: () => LedgerState | null
  save: (state: LedgerState) => void
}

// Which account is signed in is lost unless somebody looks: usage can be caught up from
// transcripts later, the login at that moment cannot.
const SAMPLE_INTERVAL_MS = 15_000
const ORCA_INTERVAL_MS = 5 * 60_000
// Opening the Accounts view asks Orca again, but each ask starts Orca's command line.
const ORCA_MIN_GAP_MS = 30_000
const SAVE_DELAY_MS = 30_000

// Watches which account is signed in, files token usage under it and keeps the totals on
// disk. With `watchAccounts` off it reads, counts and writes nothing.
export class AccountLedger {
  private state: LedgerState | null = null
  private isWatching: boolean
  // False until the first look after watching began: until then no line can be attributed.
  private hasSampled = false
  private waiting: UsageDelta[] = []
  private sampling: Promise<void> | null = null
  private isAskingOrca = false
  private orcaAskedAtMs = Number.NEGATIVE_INFINITY
  private timers: NodeJS.Timeout[] = []
  private saveTimer: NodeJS.Timeout | null = null
  private isUnsaved = false
  private hasLoadFailed = false
  private shownToOffice = JSON.stringify(null)
  private shownDay = ''
  private readonly listeners = new Set<(state: AccountsState) => void>()
  private readonly officeListeners = new Set<() => void>()
  private readonly watchingListeners = new Set<() => void>()

  constructor(private readonly options: AccountLedgerOptions) {
    this.isWatching = options.isWatching
  }

  start(): void {
    this.timers = [
      setInterval(() => void this.sample(), SAMPLE_INTERVAL_MS),
      setInterval(() => void this.askOrca(), ORCA_INTERVAL_MS)
    ]
    void this.sample().then(() => this.askOrca())
  }

  stop(): void {
    for (const timer of this.timers) clearInterval(timer)
    this.timers = []
    this.save()
  }

  get isWatchingAccounts(): boolean {
    return this.isWatching
  }

  // Fires after watching was switched on or off.
  onWatchingChange(listener: () => void): () => void {
    this.watchingListeners.add(listener)
    return () => {
      this.watchingListeners.delete(listener)
    }
  }

  setWatching(isWatching: boolean): void {
    if (isWatching === this.isWatching) return
    this.isWatching = isWatching
    for (const listener of this.watchingListeners) listener()
    if (isWatching) {
      void this.sample().then(() => this.askOrca())
      return
    }
    this.save()
    // Dropped, so switching back on starts from the file exactly as a restart does.
    this.state = null
    this.hasSampled = false
    this.waiting = []
    this.publish()
  }

  onChange(listener: (state: AccountsState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  // Fires when what the Office shows of accounts changed: a label, a plan, who is signed in.
  onOfficeChange(listener: () => void): () => void {
    this.officeListeners.add(listener)
    return () => {
      this.officeListeners.delete(listener)
    }
  }

  view(): AccountsState {
    return this.tracked ? toAccountsState(this.tracked, Date.now()) : { status: 'off' }
  }

  // What the Accounts view opens with: waits for the first look and refreshes Orca's list.
  async dashboardState(): Promise<AccountsState> {
    if (this.isWatching && !this.hasSampled) await this.sample()
    if (Date.now() - this.orcaAskedAtMs >= ORCA_MIN_GAP_MS) void this.askOrca()
    return this.view()
  }

  setAlias(key: unknown, alias: unknown): AliasResult {
    if (!this.tracked) return { success: false, reason: 'off' }
    const result = setAlias(this.tracked, key, alias)
    if (result.success) this.changed()
    return result
  }

  decorate = (snapshot: OfficeSnapshot): OfficeSnapshot => decorateSnapshot(this.tracked, snapshot)

  decorateSession = (session: SessionRef): SessionRef => decorateSession(this.tracked, session)

  ingestBridgeMessage(message: unknown): void {
    if (!this.isWatching) return
    const deltas = toUsageDeltas(message)
    if (!deltas.length) return
    if (this.tracked) {
      if (countUsage(this.tracked, deltas, Date.now())) this.changed()
      // Held only for a loaded ledger awaiting its first look. With no ledger they are dropped:
      // the bridge reports every live transcript again when it next starts.
    } else if (this.state) this.waiting = this.waiting.concat(deltas)
  }

  observeSessions(sessions: readonly SessionRef[]): void {
    if (this.tracked && countCodexSessions(this.tracked, sessions, Date.now())) this.changed()
  }

  // The ledger once it can attribute: watching, loaded, and having looked at least once.
  private get tracked(): LedgerState | null {
    return this.isWatching && this.hasSampled ? this.state : null
  }

  private sample(): Promise<void> {
    // A look runs off a timer for the life of the app: a failure is reported, never thrown.
    this.sampling ??= this.lookAtLogin()
      .catch(() => console.error('[accounts] the sign-in could not be read'))
      .finally(() => {
        this.sampling = null
      })
    return this.sampling
  }

  private async lookAtLogin(): Promise<void> {
    if (!this.isWatching || !this.load()) return
    const read = await this.options.readDefaultIdentity()
    const state = this.state
    // Watching may have been switched off while the file was being read.
    if (!this.isWatching || !state) return
    const now = Date.now()
    const before = JSON.stringify([state.accounts, state.spans])
    recordIdentity(state, read, now)
    prune(state, now)
    const isFirstLook = !this.hasSampled
    this.hasSampled = true
    const hasCounted = countUsage(state, this.waiting, now)
    this.waiting = []
    if (hasCounted || before !== JSON.stringify([state.accounts, state.spans])) this.changed()
    else if (isFirstLook || dayKey(now) !== this.shownDay) this.publish()
  }

  private load(): boolean {
    if (this.state) return true
    try {
      this.state = this.options.load() ?? emptyLedger(Date.now())
      this.hasLoadFailed = false
    } catch {
      // The error names a path under the user's home, so only the fact is logged, and once.
      if (!this.hasLoadFailed) console.error('[accounts] the ledger could not be read')
      this.hasLoadFailed = true
    }
    return this.state !== null
  }

  private async askOrca(): Promise<void> {
    if (!this.tracked || this.isAskingOrca) return
    this.isAskingOrca = true
    this.orcaAskedAtMs = Date.now()
    try {
      const [identities, list] = await Promise.all([
        this.options.readOrcaIdentities(),
        this.options.listOrcaAccounts()
      ])
      const state = this.tracked
      if (!state) return
      const fingerprint = (): string =>
        JSON.stringify([state.accounts, [...state.limits], state.codexDefaultKey])
      const before = fingerprint()
      for (const identity of identities) upsertClaudeAccount(state, identity, 'orca', Date.now())
      if (list) mergeOrcaAccounts(state, list, Date.now())
      if (before !== fingerprint()) this.changed()
    } catch {
      console.error('[accounts] Orca’s accounts could not be read')
    } finally {
      this.isAskingOrca = false
    }
  }

  private changed(): void {
    this.isUnsaved = true
    this.saveTimer ??= setTimeout(() => this.save(), SAVE_DELAY_MS)
    this.publish()
  }

  private save(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer)
    this.saveTimer = null
    if (!this.isUnsaved || !this.state) return
    try {
      this.options.save(this.state)
      this.isUnsaved = false
    } catch {
      console.error('[accounts] the ledger could not be saved')
    }
  }

  private publish(): void {
    const view = this.view()
    this.shownDay = dayKey(Date.now())
    for (const listener of this.listeners) listener(view)
    const office = JSON.stringify(this.tracked && officeAccounts(this.tracked))
    if (office === this.shownToOffice) return
    this.shownToOffice = office
    for (const listener of this.officeListeners) listener()
  }
}
