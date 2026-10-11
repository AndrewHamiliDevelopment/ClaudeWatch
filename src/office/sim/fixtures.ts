import type { SessionRef } from '../../shared/office/types'

export function session(key: string, project = 'p_a'): SessionRef {
  return {
    key,
    projectKey: project,
    projectLabel: project,
    provider: 'claude',
    sessionId: key,
    pid: null,
    name: key,
    cwd: '/project',
    worktree: null,
    host: 'terminal',
    orcaPaneKey: null,
    activity: 'idle',
    attention: 'none',
    currentTool: null,
    subagents: [],
    startedAtMs: 0,
    updatedAtMs: 0
  }
}
