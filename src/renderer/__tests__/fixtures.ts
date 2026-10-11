import { projectKey } from '../../shared/office/project-key'
import type { SessionRef } from '../../shared/office/types'
import type { ClaudeInstance } from '../lib/types'

export const NOW_MS = new Date('2026-10-11T12:00:00').getTime()

export function instanceFixture(overrides: Partial<ClaudeInstance> = {}): ClaudeInstance {
  return {
    pid: 1234,
    tty: '/dev/ttys001',
    status: 'active',
    cpuPercent: 12.5,
    memPercent: 3.2,
    elapsedTime: '5:30',
    elapsedSeconds: 330,
    projectPath: '/Users/test/ZKidz/ClaudeWatch',
    projectName: 'ZKidz/ClaudeWatch',
    flags: ['--model', 'opus'],
    sessionId: 'abc-123',
    startedAt: new Date('2026-10-11T11:00:00'),
    ...overrides
  }
}

export function sessionFixture(overrides: Partial<SessionRef> = {}): SessionRef {
  return {
    key: 'claude:abc-123',
    provider: 'claude',
    sessionId: 'abc-123',
    pid: 1234,
    name: 'token ledger',
    cwd: '/Users/test/ZKidz/ClaudeWatch',
    // The bridge hashes the project root; fixtures must too, or squads would not line up.
    projectKey: projectKey(overrides.projectRoot ?? '/Users/test/ZKidz/ClaudeWatch'),
    projectLabel: 'ClaudeWatch',
    projectRoot: '/Users/test/ZKidz/ClaudeWatch',
    companyKey: '/Users/test/ZKidz',
    companyLabel: 'ZKidz',
    worktree: null,
    host: 'orca',
    orcaPaneKey: null,
    activity: 'editing',
    attention: 'none',
    currentTool: null,
    subagents: [],
    startedAtMs: NOW_MS - 3_600_000,
    updatedAtMs: NOW_MS - 60_000,
    ...overrides
  }
}
