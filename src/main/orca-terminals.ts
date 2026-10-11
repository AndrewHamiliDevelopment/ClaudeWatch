// Runs the orca CLI with a fixed argv and returns stdout; supplied by office-setup.
export type OrcaExec = (args: string[]) => Promise<string>

export type AgentCommand = 'claude' | 'codex'

interface TerminalEntry {
  handle: string
  tabId: string
  leafId: string
  worktreePath: string
  incarnationId?: unknown
  agentIdentity?: unknown
  connected?: unknown
  writable?: unknown
  orphaned?: unknown
}

export interface PaneTerminal {
  handle: string
  worktreePath: string
  // The agent Orca sees running in the pane right now ('claude', 'codex', …); null for a plain shell.
  agent: string | null
  // Changes when the pane's process is restarted.
  incarnationId: string
}

function result(stdout: string): Record<string, unknown> {
  const envelope: unknown = JSON.parse(stdout)
  if (
    typeof envelope !== 'object' ||
    envelope === null ||
    !('ok' in envelope) ||
    envelope.ok !== true ||
    !('result' in envelope) ||
    typeof envelope.result !== 'object' ||
    envelope.result === null
  ) {
    throw new Error('Orca command failed')
  }
  return envelope.result as Record<string, unknown>
}

function isTerminalEntry(value: unknown): value is TerminalEntry {
  if (typeof value !== 'object' || value === null) return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.handle === 'string' &&
    typeof entry.tabId === 'string' &&
    typeof entry.leafId === 'string' &&
    typeof entry.worktreePath === 'string'
  )
}

// Every value (prompt text included) travels as its own argv element, never through a shell.
export class OrcaTerminals {
  constructor(private readonly exec: OrcaExec) {}

  async handleFor(paneKey: string): Promise<PaneTerminal | null> {
    const listed = result(await this.exec(['terminal', 'list', '--json'])).terminals
    const terminals = Array.isArray(listed) ? listed.filter(isTerminalEntry) : []
    const match = terminals.find((t) => `${t.tabId}:${t.leafId}` === paneKey)
    // No incarnation id (an older Orca) means a restarted pane cannot be told apart: unusable.
    if (!match || typeof match.incarnationId !== 'string' || !match.incarnationId) return null
    if (match.connected === false || match.writable === false || match.orphaned === true)
      return null
    return {
      handle: match.handle,
      worktreePath: match.worktreePath,
      agent:
        typeof match.agentIdentity === 'string' && match.agentIdentity ? match.agentIdentity : null,
      incarnationId: match.incarnationId
    }
  }

  async sendPrompt(handle: string, text: string): Promise<void> {
    result(
      await this.exec([
        'terminal',
        'send',
        '--terminal',
        handle,
        '--text',
        text,
        '--enter',
        '--json'
      ])
    )
  }

  async sendKey(handle: string, key: string): Promise<void> {
    result(await this.exec(['terminal', 'send', '--terminal', handle, '--text', key, '--json']))
  }

  async screen(handle: string): Promise<string[]> {
    const read = result(
      await this.exec(['terminal', 'read', '--terminal', handle, '--screen', '--json'])
    )
    const terminal = read.terminal as { tail?: unknown } | undefined
    return Array.isArray(terminal?.tail) ? terminal.tail.filter((l) => typeof l === 'string') : []
  }

  async create(worktreePath: string, command: AgentCommand, title: string): Promise<void> {
    result(
      await this.exec([
        'terminal',
        'create',
        '--worktree',
        `path:${worktreePath}`,
        '--command',
        command,
        '--title',
        title,
        '--focus',
        '--json'
      ])
    )
  }
}
