import { basename } from 'node:path'
import type { SessionRef, SubagentRef } from '../shared/office/types'
import { projectKey } from '../shared/office/project-key'
import type { RegistryEntry } from './registry'
import type { TranscriptState } from './transcript-tail'
import { toolActivity } from './tool-category'

export function sessionFromRegistry(
  entry: RegistryEntry,
  transcript: TranscriptState,
  subagents: SubagentRef[],
  root: string,
  worktree: string | null
): SessionRef {
  const waiting = entry.status === 'waiting'
  return {
    key: `claude:${entry.sessionId}`,
    provider: 'claude',
    sessionId: entry.sessionId,
    pid: entry.pid,
    name: entry.name || basename(entry.cwd),
    cwd: entry.cwd,
    projectKey: projectKey(root),
    projectLabel: basename(root),
    worktree,
    host: 'terminal',
    orcaPaneKey: null,
    activity:
      entry.status === 'idle'
        ? 'idle'
        : transcript.tool
          ? toolActivity(transcript.tool.category)
          : entry.status === 'busy'
            ? 'thinking'
            : entry.status === 'shell'
              ? 'running'
              : 'idle',
    attention: waiting
      ? /permission|approval/i.test(entry.waitingFor)
        ? 'permission'
        : 'question'
      : transcript.error
        ? 'error'
        : 'none',
    currentTool: transcript.tool,
    subagents,
    startedAtMs: Date.parse(`${entry.procStart} UTC`) || 0,
    updatedAtMs: entry.updatedAtMs
  }
}
