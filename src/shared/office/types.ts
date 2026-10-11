// Contract between the bridge (truth), the office sim and the office renderer.
// Frozen for milestone 1: change it only together with every consumer.

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

export interface SubagentRef {
  id: string
  type: string
  activity: AgentActivity
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
  worktree: string | null
  host: SessionHost
  orcaPaneKey: string | null
  activity: AgentActivity
  attention: AgentAttention
  currentTool: CurrentTool | null
  subagents: SubagentRef[]
  startedAtMs: number
  updatedAtMs: number
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
}

export type FeedMessage =
  | { type: 'hello'; v: 1; snapshot: OfficeSnapshot }
  | { type: 'patch'; v: 1; seq: number; upserts: SessionRef[]; removed: string[] }
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
