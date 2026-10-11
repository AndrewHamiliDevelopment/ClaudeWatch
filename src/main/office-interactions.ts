import { createHash } from 'crypto'
import { parseAgentKey } from '../shared/office/agent-key'
import { needsHuman } from '../shared/office/attention'
import type {
  FocusResult,
  InteractionFailure,
  InteractionResult,
  OfficeSnapshot,
  PeekResult,
  PermissionDecision,
  ProviderId,
  SessionRef,
  SubagentRef
} from '../shared/office/types'
import type { AgentCommand, OrcaTerminals, PaneTerminal } from './orca-terminals'

interface OfficeInteractionsDeps {
  snapshot: () => OfficeSnapshot | null
  orca: Pick<OrcaTerminals, 'handleFor' | 'sendPrompt' | 'sendKey' | 'screen' | 'create' | 'focus'>
  openTerminalRunning: (path: string, command: AgentCommand) => Promise<{ success: boolean }>
  // When the process with this pid started (epoch ms), or null when no such process runs.
  processStart: (pid: number) => Promise<number | null>
  // Brings Orca's window forward; false when it could not.
  raiseOrca: () => Promise<boolean>
  // Shows the agent outside Orca: opens its folder in the terminal app hosting that pid, or,
  // for a caller that may not type, only brings that app forward and says so in `target`.
  openFolder: (
    path: string,
    pid: number | null
  ) => Promise<{ success: boolean; target?: 'terminal' | 'terminal-app' }>
}

// The process a pane must be proven to belong to before anything touches it: a session, or a
// teammate with its own process and pane inside its lead's folder.
export type PaneOwner = Pick<
  SessionRef,
  'provider' | 'cwd' | 'projectRoot' | 'host' | 'pid' | 'startedAtMs' | 'orcaPaneKey'
>

const MAX_PROMPT_LENGTH = 4000
const PEEK_LINES = 40
// Claude Code's permission dialog; respond() sends nothing unless it is on screen.
const PERMISSION_PROMPT = /Do you want to (proceed|make this edit|create|allow)|❯\s*1\.\s*Yes/
const DECISION_KEYS: Record<PermissionDecision, string> = { approve: '1', deny: '\u001b' }
// Claude Code reports 'waiting' only while a dialog covers its prompt (a permission, a picker,
// an MCP form), never for a turn that merely ended with a question: that one is idle.
// The rule Claude Code draws directly above and below its input line.
const RULE = /^─{8,}/
// Status lines and a task list sit under Claude Code's input line; Codex shows a footer or two.
const CLAUDE_FOOTER_LINES = 24
const CODEX_FOOTER_LINES = 4
// A highlighted row of a picker or dialog, boxed or not.
const POINTER_ROW = /^[\s│|]*[❯›]\s/
const AGENT_TITLES: Record<ProviderId, string> = {
  claude: 'New Claude agent',
  codex: 'New Codex agent'
}

// What Orca calls each provider's agent in a pane.
const ORCA_AGENTS: Record<ProviderId, readonly string[]> = {
  claude: ['claude', 'claude-agent-teams'],
  codex: ['codex']
}

const fail = (reason: InteractionFailure): InteractionResult => ({ success: false, reason })

// The last PEEK_LINES rendered lines without trailing blanks: what the owner sees in the office.
function visibleLines(screen: string[]): string[] {
  let end = screen.length
  while (end > 0 && !screen[end - 1].trim()) end--
  return screen.slice(Math.max(0, end - PEEK_LINES), end)
}

// True only when the bottom of the screen is the agent's own input line, in a shape read off
// live panes; a dialog, a picker or any screen not recognised is not one, so nothing is typed.
// Claude Code: `❯` in the first column, alone or before a draft, a rule directly above and below.
// Codex: `›` in the first column before its placeholder or a draft, never a numbered row, with
// only indented footer lines under it, one of them the shortcuts hint.
function showsInputLine(agent: string | null, screen: string[]): boolean {
  if (ORCA_AGENTS.codex.some((name) => name === agent)) {
    const at = screen.findLastIndex((line) => /^›\s/.test(line))
    const footer = screen.slice(at + 1)
    return (
      at >= 0 &&
      !/^›\s*\d+[.)]/.test(screen[at]) &&
      footer.length <= CODEX_FOOTER_LINES &&
      footer.every((line) => /^\s{2}\S/.test(line)) &&
      footer.some((line) => /^\s+\? for shortcuts/.test(line))
    )
  }
  const at = screen.findLastIndex((line) => /^❯(\s|$)/.test(line))
  const footer = screen.slice(at + 2)
  return (
    at > 0 &&
    RULE.test(screen[at - 1]) &&
    RULE.test(screen[at + 1] ?? '') &&
    footer.length <= CLAUDE_FOOTER_LINES &&
    !footer.some((line) => POINTER_ROW.test(line))
  )
}

const fingerprintOf = (lines: string[]): string =>
  createHash('sha256').update(lines.join('\n')).digest('hex')
const isPrintable = (text: string): boolean => !/\p{Cc}/u.test(text)
const isWithin = (path: string, folder: string): boolean =>
  path === folder || path.startsWith(`${folder.replace(/\/+$/, '')}/`)
// The pane must be in this session's folder and still running its agent: once the agent
// exits the pane is a shell, and typed text would run as a command.
const paneServes = (terminal: PaneTerminal, owner: PaneOwner): boolean =>
  (terminal.worktreePath === owner.projectRoot || isWithin(owner.cwd, terminal.worktreePath)) &&
  terminal.agent !== null &&
  ORCA_AGENTS[owner.provider].includes(terminal.agent)

// Everything the office can do to a running agent goes through here, and only on a
// user's click: talk, answer a permission prompt, peek at the screen, start a new agent.
export class OfficeInteractions {
  // The screen each session's owner last looked at; an answer spends it.
  private readonly reviews = new Map<string, { fingerprint: string; incarnationId: string }>()
  // Jumps run one at a time, so two quick clicks end on the second agent.
  private lastFocus: Promise<unknown> = Promise.resolve()

  constructor(private readonly deps: OfficeInteractionsDeps) {}

  async send(sessionKey: string, text: string): Promise<InteractionResult> {
    if (typeof text !== 'string') return fail('invalid-input')
    // A raw newline in the agent's terminal would submit half the message, so lines are joined.
    const prompt = text.replace(/\s*\r?\n\s*/g, ' ').trim()
    if (!prompt || prompt.length > MAX_PROMPT_LENGTH || !isPrintable(prompt)) {
      return fail('invalid-input')
    }
    const attention = this.session(sessionKey)?.attention
    if (needsHuman(attention)) return fail('prompt-on-screen')
    return this.withTerminal(sessionKey, async ({ handle, agent }) => {
      // The snapshot is seconds old and says nothing of a teammate or a Codex agent, so the
      // screen decides. A dialog that opens between this read and the send is not caught.
      const screen = visibleLines(await this.deps.orca.screen(handle))
      if (!showsInputLine(agent, screen)) return fail('prompt-on-screen')
      await this.deps.orca.sendPrompt(handle, prompt)
      return { success: true }
    })
  }

  // Answers only the prompt the owner reviewed, once: if the screen or the terminal changed since
  // peek, nothing is sent. Orca has no conditional send, so a prompt replaced in the instant
  // between the screen read and the key press is not caught.
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
    const review = this.reviews.get(sessionKey)
    if (review?.fingerprint !== reviewedFingerprint) return fail('prompt-changed')
    // Spent before the first await, so two racing answers cannot share one review.
    this.reviews.delete(sessionKey)
    return this.withTerminal(sessionKey, async ({ handle, incarnationId }) => {
      if (incarnationId !== review.incarnationId) return fail('prompt-changed')
      const lines = visibleLines(await this.deps.orca.screen(handle))
      if (!PERMISSION_PROMPT.test(lines.join('\n'))) return fail('no-permission-prompt')
      if (fingerprintOf(lines) !== reviewedFingerprint) return fail('prompt-changed')
      await this.deps.orca.sendKey(handle, DECISION_KEYS[decision])
      return { success: true }
    })
  }

  async peek(sessionKey: string): Promise<PeekResult> {
    let lines: string[] = []
    let incarnationId = ''
    const outcome = await this.withTerminal(sessionKey, async (terminal) => {
      lines = visibleLines(await this.deps.orca.screen(terminal.handle))
      incarnationId = terminal.incarnationId
      return { success: true }
    })
    // Only a session can be answered, so only a session's peek is a review.
    if (!outcome.success || !this.session(sessionKey)) return { ...outcome, lines }
    const fingerprint = fingerprintOf(lines)
    const live = new Set(this.deps.snapshot()?.sessions.map((s) => s.key))
    for (const key of this.reviews.keys()) if (!live.has(key)) this.reviews.delete(key)
    this.reviews.set(sessionKey, { fingerprint, incarnationId })
    return { ...outcome, lines, fingerprint }
  }

  async start(projectKey: string, provider: ProviderId): Promise<InteractionResult> {
    if (!Object.hasOwn(AGENT_TITLES, provider)) return fail('invalid-input')
    const anchor = this.deps.snapshot()?.sessions.find((s) => s.projectKey === projectKey)
    if (!anchor) return fail('unknown-session')
    const folder = anchor.projectRoot
    try {
      await this.deps.orca.create(folder, provider, AGENT_TITLES[provider])
      return { success: true }
    } catch {
      return this.deps.openTerminalRunning(folder, provider)
    }
  }

  // Jumps to an agent's pane. `agentKey` is a session key, or `${sessionKey}#${subagentId}`.
  async focus(agentKey: string): Promise<FocusResult> {
    const owner = this.ownerOf(agentKey)
    return owner ? this.focusProcess(owner) : fail('unknown-session')
  }

  focusProcess(owner: PaneOwner): Promise<FocusResult> {
    const focused = this.lastFocus.then(() => this.focusNow(owner))
    this.lastFocus = focused.catch(() => undefined)
    return focused
  }

  // Types nothing into Orca. A pane that cannot be proven to be this agent's is not switched to: Orca
  // alone comes forward, and the result says why.
  private async focusNow(owner: PaneOwner): Promise<FocusResult> {
    if (owner.host !== 'orca') {
      const opened = await this.deps.openFolder(owner.cwd, owner.pid)
      return opened.success
        ? { success: true, target: opened.target ?? 'terminal' }
        : { success: false }
    }
    // A child agent shares its parent's pane, so the bridge leaves it without a pane key.
    const pane = owner.orcaPaneKey
      ? await this.withPane(owner, async ({ handle }) =>
          (await this.deps.orca.focus(handle)) ? { success: true } : fail('orca-unavailable')
        )
      : fail('terminal-not-found')
    // Orca's switch does not raise its window, and a hidden window should open on the pane.
    if (!(await this.deps.raiseOrca())) return fail(pane.reason ?? 'orca-unavailable')
    return pane.success ? { success: true, target: 'pane' } : { ...pane, target: 'app' }
  }

  // Where an agent can be looked at. A subagent lives in its lead's process and pane.
  private ownerOf(agentKey: string): PaneOwner | null {
    const agent = this.resolve(agentKey)
    if (!agent?.member) return agent?.session ?? null
    return this.teammate(agent.session, agent.member) ?? agent.session
  }

  // Where an agent can be typed to or read: its own terminal only. Text for a subagent would
  // land in its lead's prompt, so a subagent has none.
  private terminalOwner(agentKey: string): PaneOwner | null {
    const agent = this.resolve(agentKey)
    if (!agent?.member) return agent?.session ?? null
    return this.teammate(agent.session, agent.member)
  }

  // The one reading of an agent key every action shares: a session, or one member of one
  // lead. A key with two readings (a repeated id, a session key holding '#') names no one.
  private resolve(agentKey: string): { session: SessionRef; member?: SubagentRef } | null {
    return parseAgentKey(agentKey, this.deps.snapshot()?.sessions ?? [])
  }

  // A teammate has its own process and pane, in its own folder when the roster names one.
  private teammate(lead: SessionRef, member: SubagentRef): PaneOwner | null {
    if (member.kind !== 'teammate') return null
    return {
      provider: lead.provider,
      cwd: member.cwd ?? lead.cwd,
      projectRoot: lead.projectRoot,
      host: member.orcaPaneKey ? 'orca' : lead.host,
      pid: member.pid ?? null,
      // NaN equals no start time, so a teammate reported without one is never proven live.
      startedAtMs: member.startedAtMs ?? Number.NaN,
      orcaPaneKey: member.orcaPaneKey ?? null
    }
  }

  private session(sessionKey: string): SessionRef | undefined {
    const agent = this.resolve(sessionKey)
    return agent?.member ? undefined : agent?.session
  }

  private async withTerminal(
    agentKey: string,
    action: (terminal: PaneTerminal) => Promise<InteractionResult>
  ): Promise<InteractionResult> {
    const owner = this.terminalOwner(agentKey)
    return owner ? this.withPane(owner, action) : fail('unknown-session')
  }

  // Resolves the pane's terminal fresh each time: Orca handles go stale across reloads.
  private async withPane(
    owner: PaneOwner,
    action: (terminal: PaneTerminal) => Promise<InteractionResult>
  ): Promise<InteractionResult> {
    if (owner.host !== 'orca' || !owner.orcaPaneKey) return fail('not-in-orca')
    // The snapshot is a few seconds old: the agent may have exited, or its pid been reused.
    // A dead process is refused outright, so a missing start time can never equal "no process".
    const startedAtMs = owner.pid === null ? null : await this.deps.processStart(owner.pid)
    if (startedAtMs === null || startedAtMs !== owner.startedAtMs) return fail('unknown-session')
    try {
      const terminal = await this.deps.orca.handleFor(owner.orcaPaneKey)
      if (!terminal || !paneServes(terminal, owner)) return fail('terminal-not-found')
      return await action(terminal)
    } catch {
      return fail('orca-unavailable')
    }
  }
}
