import { expect, it } from 'vitest'
import type { SessionRef } from './office/types'
import { codexTotalOf } from './accounts'

const counts = (output: number) => ({ input: 0, output, cacheWrite: 0, cacheRead: 0 })
const codex = (overrides: Partial<SessionRef> = {}): SessionRef => ({
  key: 'codex:c',
  provider: 'codex',
  sessionId: 'c',
  pid: 42,
  name: 'repo',
  cwd: '/repo',
  projectKey: 'p_repo',
  projectLabel: 'repo',
  projectRoot: '/repo',
  companyKey: 'c_test',
  companyLabel: 'Test Co',
  worktree: null,
  host: 'terminal',
  orcaPaneKey: null,
  activity: 'idle',
  attention: 'none',
  currentTool: null,
  subagents: [],
  startedAtMs: 0,
  updatedAtMs: 1000,
  threadStartedAtMs: 500,
  accountKey: 'codex:aaaaaaaaaaaa',
  usage: {
    own: counts(40),
    subagents: counts(0),
    spawned: 0,
    contextTokens: 9,
    contextLimit: 272000
  },
  ...overrides
})

it('reads a Codex session as its running total and what the ledger files it under', () => {
  expect(codexTotalOf(codex())).toEqual({
    sessionKey: 'codex:c',
    projectKey: 'p_repo',
    projectLabel: 'repo',
    accountKey: 'codex:aaaaaaaaaaaa',
    threadStartedAtMs: 500,
    counts: counts(40)
  })
  expect(
    codexTotalOf(codex({ accountKey: undefined, threadStartedAtMs: undefined }))
  ).toMatchObject({ accountKey: null, threadStartedAtMs: null })
})

it('has no total for a Codex session not counted yet, or for a Claude session', () => {
  expect(codexTotalOf(codex({ usage: null }))).toBeNull()
  // Claude's tokens are counted from its transcript lines, which carry their own times.
  expect(codexTotalOf(codex({ key: 'claude:a', provider: 'claude' }))).toBeNull()
})
