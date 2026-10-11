import { createHash } from 'crypto'
import type {
  InteractionFailure,
  InteractionResult,
  OfficeSnapshot,
  PeekResult,
  PermissionDecision,
  ProviderId,
  SessionRef
} from '../shared/office/types'
import type { AgentCommand, OrcaTerminals } from './orca-terminals'

interface OfficeInteractionsDeps {
  snapshot: () => OfficeSnapshot | null
  orca: Pick<OrcaTerminals, 'handleFor' | 'sendPrompt' | 'sendKey' | 'screen' | 'create'>
  openTerminalRunning: (path: string, command: AgentCommand) => Promise<{ success: boolean }>
}

const MAX_PROMPT_LENGTH = 4000
const PEEK_LINES = 40
// Claude Code's permission dialog; respond() sends nothing unless it is on screen.
const PERMISSION_PROMPT = /Do you want to (proceed|make this edit|create|allow)|❯\s*1\.\s*Yes/
const DECISION_KEYS: Record<PermissionDecision, string> = { approve: '1', deny: '\u001b' }
const AGENT_TITLES: Record<ProviderId, string> = {
  claude: 'New Claude agent',
  codex: 'New Codex agent'
}

const fail = (reason: InteractionFailure): InteractionResult => ({ success: false, reason })

// The last PEEK_LINES rendered lines without trailing blanks: what the owner sees in the office.
function visibleLines(screen: string[]): string[] {
  let end = screen.length
  while (end > 0 && !screen[end - 1].trim()) end--
  return screen.slice(Math.max(0, end - PEEK_LINES), end)
}

const fingerprintOf = (lines: string[]): string =>
  createHash('sha256').update(lines.join('\n')).digest('hex')
const isPrintable = (text: string): boolean => !/\p{Cc}/u.test(text)

// Everything the office can do to a running agent goes through here, and only on a
// user's click: talk, answer a permission prompt, peek at the screen, start a new agent.
export class OfficeInteractions {
  constructor(private readonly deps: OfficeInteractionsDeps) {}

  async send(sessionKey: string, text: string): Promise<InteractionResult> {
    if (typeof text !== 'string' || !text.trim() || text.length > MAX_PROMPT_LENGTH) {
      return fail('invalid-input')
    }
    if (!isPrintable(text)) return fail('invalid-input')
    return this.withTerminal(sessionKey, async (handle) => {
      await this.deps.orca.sendPrompt(handle, text)
      return { success: true }
    })
  }

  // Answers only the prompt the owner reviewed: if the screen changed since peek, nothing is sent.
  async respond(
    sessionKey: string,
    decision: PermissionDecision,
    reviewedFingerprint: string
  ): Promise<InteractionResult> {
    if (!Object.hasOwn(DECISION_KEYS, decision)) return fail('invalid-input')
    if (typeof reviewedFingerprint !== 'string' || !reviewedFingerprint) {
      return fail('invalid-input')
    }
    const session = this.session(sessionKey)
    if (!session) return fail('unknown-session')
    if (session.provider !== 'claude') return fail('unsupported-provider')
    if (session.attention !== 'permission') return fail('no-permission-prompt')
    return this.withTerminal(sessionKey, async (handle) => {
      const lines = visibleLines(await this.deps.orca.screen(handle))
      if (!PERMISSION_PROMPT.test(lines.join('\n'))) return fail('no-permission-prompt')
      if (fingerprintOf(lines) !== reviewedFingerprint) return fail('prompt-changed')
      await this.deps.orca.sendKey(handle, DECISION_KEYS[decision])
      return { success: true }
    })
  }

  async peek(sessionKey: string): Promise<PeekResult> {
    let lines: string[] = []
    const outcome = await this.withTerminal(sessionKey, async (handle) => {
      lines = visibleLines(await this.deps.orca.screen(handle))
      return { success: true }
    })
    return outcome.success
      ? { ...outcome, lines, fingerprint: fingerprintOf(lines) }
      : { ...outcome, lines }
  }

  async start(projectKey: string, provider: ProviderId): Promise<InteractionResult> {
    if (!Object.hasOwn(AGENT_TITLES, provider)) return fail('invalid-input')
    const anchor = this.deps.snapshot()?.sessions.find((s) => s.projectKey === projectKey)
    if (!anchor) return fail('unknown-session')
    const folder = anchor.worktree ?? anchor.cwd
    try {
      await this.deps.orca.create(folder, provider, AGENT_TITLES[provider])
      return { success: true }
    } catch {
      return this.deps.openTerminalRunning(folder, provider)
    }
  }

  private session(sessionKey: string): SessionRef | undefined {
    return this.deps.snapshot()?.sessions.find((s) => s.key === sessionKey)
  }

  // Resolves the pane's terminal fresh each time: Orca handles go stale across reloads.
  private async withTerminal(
    sessionKey: string,
    action: (handle: string) => Promise<InteractionResult>
  ): Promise<InteractionResult> {
    const session = this.session(sessionKey)
    if (!session) return fail('unknown-session')
    if (session.host !== 'orca' || !session.orcaPaneKey) return fail('not-in-orca')
    try {
      const handle = await this.deps.orca.handleFor(session.orcaPaneKey)
      if (!handle) return fail('terminal-not-found')
      return await action(handle)
    } catch {
      return fail('orca-unavailable')
    }
  }
}
