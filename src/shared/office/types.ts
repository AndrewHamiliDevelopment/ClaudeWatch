// Contract between the bridge (truth), the office sim and the office renderer.
// Change it only together with every consumer; additions stay optional until all of them read it.

export type ProviderId = 'claude' | 'codex'

export type AgentActivity =
  | 'idle'
  | 'thinking'
  | 'reading'
  | 'editing'
  | 'running'
  | 'searching'
  | 'delegating'

// What the human owes this session, if anything. 'done' means the turn ended, not "needs you".
export type AgentAttention = 'none' | 'permission' | 'question' | 'done' | 'error' | 'limited'

export type ToolCategory = 'read' | 'edit' | 'run' | 'web' | 'agent' | 'other'

export type SessionHost = 'terminal' | 'orca' | 'vscode' | 'unknown'

export interface CurrentTool {
  name: string
  category: ToolCategory
}

// Tokens counted from the transcript since the session began. Numbers only, never text.
export interface TokenUsage {
  input: number
  output: number
  cacheRead: number
  cacheCreation: number
}

export interface SubagentRef {
  id: string
  type: string
  activity: AgentActivity
  // A teammate is an agent-team member with its own process and pane; a subagent runs inside
  // its parent. Absent means subagent.
  kind?: 'subagent' | 'teammate'
  name?: string // the teammate's own name, e.g. "lena-b5-themes"
  pid?: number | null
  startedAtMs?: number
  orcaPaneKey?: string | null
  tokens?: TokenUsage | null
}

export type AccountConfidence = 'exact' | 'inferred' | 'unattributed'

// An account as the Office may show it: a label and a plan, never an email or an id.
export interface AccountRef {
  key: string
  provider: ProviderId
  label: string
  plan: string | null
  isActive: boolean
}

export interface SessionRef {
  key: string // `${provider}:${sessionId}`
  provider: ProviderId
  sessionId: string
  pid: number | null
  name: string // session name, else the cwd basename
  cwd: string
  projectKey: string
  projectLabel: string
  projectRoot: string // main repo root (worktrees resolve to it)
  // The company is the folder holding the project (e.g. ~/Work/ZKidz); it groups offices on the floor.
  companyKey: string
  companyLabel: string
  worktree: string | null
  host: SessionHost
  orcaPaneKey: string | null
  activity: AgentActivity
  attention: AgentAttention
  currentTool: CurrentTool | null
  subagents: SubagentRef[]
  startedAtMs: number
  updatedAtMs: number
  tokens?: TokenUsage | null
  accountKey?: string | null
  accountConfidence?: AccountConfidence
}

export interface SourceHealth {
  id: string
  ok: boolean
  detail: string
}

export interface OfficeSnapshot {
  rev: number
  generatedAtMs: number
  sessions: SessionRef[]
  sources: SourceHealth[]
  accounts?: AccountRef[]
}

export type FeedMessage =
  | { type: 'hello'; v: 1; snapshot: OfficeSnapshot }
  | {
      type: 'patch'
      v: 1
      seq: number
      upserts: SessionRef[]
      removed: string[]
      // Present only when a source's health changed.
      sources?: SourceHealth[]
    }
  | { type: 'resync' }

// What the renderer draws for one agent; produced by the sim, never by raw events.
export interface AgentView {
  agentKey: string
  floorId: string
  roomId: string
  slotId: string
  x: number
  z: number
  heading: number
  activity: AgentActivity
  attention: AgentAttention
  provider: ProviderId
  isSubagent: boolean
  label: string
}

// Why an office interaction did not happen; the UI turns each into plain words.
export type InteractionFailure =
  | 'unknown-session'
  | 'not-in-orca'
  | 'orca-unavailable'
  | 'terminal-not-found'
  | 'no-permission-prompt'
  | 'prompt-changed'
  | 'unsupported-provider'
  | 'invalid-input'

export interface InteractionResult {
  success: boolean
  reason?: InteractionFailure
}

export interface PeekResult extends InteractionResult {
  lines: string[]
  // Identifies exactly what was shown; respond() refuses if the screen no longer matches it.
  fingerprint?: string
}

// Where a focus request landed: the agent's exact pane, only the Orca app (the pane could not
// be proven to be the agent's), or a terminal opened at the session's folder.
export interface FocusResult extends InteractionResult {
  target?: 'pane' | 'app' | 'terminal'
}

export type PermissionDecision = 'approve' | 'deny'
