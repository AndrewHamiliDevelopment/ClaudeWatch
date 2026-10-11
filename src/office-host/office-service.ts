import type { BridgeHost } from '../main/bridge-host'
import { OfficeInteractions, type PaneOwner } from '../main/office-interactions'
import { createOrcaCli } from '../main/orca-cli'
import { OrcaTerminals } from '../main/orca-terminals'
import type { execFilePromise } from '../main/platform/exec'
import { openTerminal, openTerminalRunning, raiseTerminal } from '../main/terminal-opener'
import type { TerminalType } from '../renderer/lib/types'
import type {
  FeedMessage,
  FocusResult,
  InteractionResult,
  PeekResult,
  PermissionDecision,
  ProviderId
} from '../shared/office/types'

// `ps` output is parsed, so it is read in the C locale and UTC.
export const PS_OPTIONS = { timeout: 5000, env: { LC_ALL: 'C', TZ: 'UTC' } }

interface OfficeServiceDeps {
  host: Pick<BridgeHost, 'snapshot' | 'onMessage'>
  run: typeof execFilePromise
  // The terminal app hosting that pid, for agents that run outside Orca.
  terminalOf: (pid: number) => Promise<TerminalType | undefined>
  // False for a view-only page: then nothing here types, a `cd` into a terminal included.
  isInteractive: boolean
}

// What the Office can do, whichever transport carries it. Arguments are `unknown` because
// they arrive from a renderer or a web page: every one is checked here before use.
export interface OfficeService {
  // The current state first, when the bridge has reported one, then every feed message.
  subscribe(listener: (message: FeedMessage) => void): () => void
  focus(agentKey: unknown): Promise<FocusResult>
  send(sessionKey: unknown, text: unknown): Promise<InteractionResult>
  respond(sessionKey: unknown, decision: unknown, fingerprint: unknown): Promise<InteractionResult>
  peek(sessionKey: unknown): Promise<PeekResult>
  startAgent(projectKey: unknown, provider: unknown): Promise<InteractionResult>
  focusProcess(owner: PaneOwner): Promise<FocusResult>
  // When the process with this pid started (epoch ms), or null when no such process runs.
  processStart(pid: number): Promise<number | null>
}

const INVALID: InteractionResult = { success: false, reason: 'invalid-input' }
const asString = (value: unknown): string => (typeof value === 'string' ? value : '')
const isDecision = (value: unknown): value is PermissionDecision =>
  value === 'approve' || value === 'deny'
const isProvider = (value: unknown): value is ProviderId => value === 'claude' || value === 'codex'

export function createOfficeService({
  host,
  run,
  terminalOf,
  isInteractive
}: OfficeServiceDeps): OfficeService {
  const orcaCli = createOrcaCli(run)
  const processStart = (pid: number): Promise<number | null> =>
    run('/bin/ps', ['-o', 'lstart=', '-p', String(pid)], PS_OPTIONS).then(
      ({ stdout }) => Date.parse(`${stdout.trim()} UTC`) || null,
      () => null
    )
  const interactions = new OfficeInteractions({
    snapshot: () => host.snapshot(),
    orca: new OrcaTerminals(orcaCli.exec),
    openTerminalRunning,
    processStart,
    raiseOrca: orcaCli.raise,
    openFolder: async (path, pid) => {
      const terminal = pid === null ? undefined : await terminalOf(pid)
      // Opening the folder types `cd` into the terminal app, which a view-only page may not.
      if (isInteractive) return openTerminal(path, terminal)
      return { ...(await raiseTerminal(terminal)), target: 'terminal-app' }
    }
  })

  return {
    subscribe: (listener) => {
      const snapshot = host.snapshot()
      if (snapshot) listener({ type: 'hello', v: 1, snapshot })
      return host.onMessage(listener)
    },
    focus: (agentKey) => interactions.focus(asString(agentKey)),
    send: (sessionKey, text) => interactions.send(asString(sessionKey), asString(text)),
    respond: async (sessionKey, decision, fingerprint) =>
      isDecision(decision)
        ? interactions.respond(asString(sessionKey), decision, asString(fingerprint))
        : INVALID,
    peek: (sessionKey) => interactions.peek(asString(sessionKey)),
    startAgent: async (projectKey, provider) =>
      isProvider(provider) ? interactions.start(asString(projectKey), provider) : INVALID,
    focusProcess: (owner) => interactions.focusProcess(owner),
    processStart
  }
}
