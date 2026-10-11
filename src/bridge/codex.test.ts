import { expect, it, vi } from 'vitest'
import { accountKey } from './account-key'
import { collectCodex, parseCodexProcesses, parseCodexActivity } from './codex'
import { parseCodexUsage } from './codex-usage'
import { fixtureIo } from './__fixtures__/helpers'

function tokenCount(total: number | null, cached = 0, last = 0): string {
  const usage = (input: number) => ({
    input_tokens: input,
    cached_input_tokens: cached,
    cache_write_input_tokens: 0,
    output_tokens: 40,
    reasoning_output_tokens: 30,
    total_tokens: input + 40
  })
  return JSON.stringify({
    type: 'event_msg',
    payload: {
      type: 'token_count',
      info:
        total === null
          ? null
          : {
              total_token_usage: usage(total),
              last_token_usage: usage(last),
              model_context_window: 272000
            },
      rate_limits: { primary: { used_percent: 12 } }
    }
  })
}

it('takes Codex usage from the newest token count that carries one', () => {
  const tail = [tokenCount(100, 60, 50), 'broken', tokenCount(1000, 700, 300), tokenCount(null)]
  expect(parseCodexUsage(tail.join('\n'))).toEqual({
    own: { input: 300, output: 40, cacheWrite: 0, cacheRead: 700 },
    subagents: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 },
    spawned: 0,
    contextTokens: 300,
    contextLimit: 272000
  })
})

it('reports Codex usage as unknown when the tail holds no token count', () => {
  const reasoning = JSON.stringify({ type: 'event_msg', payload: { type: 'reasoning' } })
  expect(parseCodexUsage(`${reasoning}\n${tokenCount(null)}`)).toBeNull()
  const quoted = JSON.stringify({
    type: 'response_item',
    payload: { type: 'message', text: '"token_count" total_token_usage' }
  })
  expect(parseCodexUsage(quoted)).toBeNull()
})

it('selects only CLI argv[0], excluding app-server and helpers', () => {
  const start = 'Sat Oct 10 15:29:12 2026'
  expect(
    parseCodexProcesses(
      `42 ${start} /opt/bin/codex --model test\n43 ${start} codex app-server\n44 ${start} codex exec hello\n45 ${start} node /bin/codex\n46 ${start} codex app-server-helper\n47 ${start} codex --config x app-server`
    )
  ).toEqual([
    { pid: 42, startedAtMs: Date.parse(`${start} UTC`) },
    { pid: 44, startedAtMs: Date.parse(`${start} UTC`) }
  ])
})
it.each([
  ['function_call', 'running', 'none'],
  ['custom_tool_call', 'running', 'none'],
  ['reasoning', 'thinking', 'none'],
  ['task_complete', 'idle', 'done']
])('maps Codex event %s', (type, activity, attention) => {
  expect(
    parseCodexActivity(
      `invalid\n${JSON.stringify({ type: 'event_msg', timestamp: '2026-10-11T01:00:00Z', payload: { type, text: 'SECRET_TEXT' } })}`
    )
  ).toEqual({ activity, attention, updatedAtMs: Date.parse('2026-10-11T01:00:00Z') })
})
it('matches cwd using only rollout headers then tails the newest match', async () => {
  const meta = (id: string, cwd: string) =>
    JSON.stringify({ type: 'session_meta', payload: { id, cwd } })
  const io = fixtureIo({
    '/codex/sessions/2026/10/rollout-old.jsonl': meta('old', '/repo'),
    '/codex/sessions/2026/10/rollout-new.jsonl': `${meta('new', '/repo')}\n${JSON.stringify({ type: 'event_msg', payload: { type: 'reasoning', text: 'SECRET_PROMPT' } })}\n${tokenCount(1000, 700, 300)}`,
    '/codex/sessions/rollout-other.jsonl': meta('other', '/other'),
    '/repo/.git': null
  })
  const stat = io.stat
  io.stat = async (path) =>
    path.includes('rollout-new') ? { directory: false, mtimeMs: 2000, size: 100 } : stat(path)
  io.exec = vi.fn(async (file) =>
    file.endsWith('ps') ? '42 Sat Oct 10 15:29:12 2026 /bin/codex' : 'p42\nn/repo\n'
  )
  const tail = vi.spyOn(io, 'readTail')
  const batch = await collectCodex('/codex', io)
  expect(batch.sessions[0]).toMatchObject({
    key: 'codex:new',
    pid: 42,
    activity: 'thinking',
    projectLabel: 'repo',
    usage: { own: { input: 300, cacheRead: 700 }, contextLimit: 272000 }
  })
  expect(JSON.stringify(batch.sessions)).not.toContain('SECRET_PROMPT')
  expect(tail).toHaveBeenCalledTimes(1)
  expect(batch.sources[0].ok).toBe(true)
})
it('keeps live CLI processes even without a rollout and reports process failures', async () => {
  const io = fixtureIo()
  io.exec = async (file) => (file.endsWith('ps') ? '42 Sat Oct 10 15:29:12 2026 codex' : 'n/plain')
  expect((await collectCodex('/codex', io)).sessions[0]).toMatchObject({
    provider: 'codex',
    projectLabel: 'plain',
    usage: null
  })
  io.exec = async () => {
    throw new Error('denied')
  }
  expect((await collectCodex('/codex', io)).sources[0].ok).toBe(false)
})
it('skips Codex processes running inside an app bundle (helpers, not user sessions)', async () => {
  const io = fixtureIo()
  io.exec = async (file) =>
    file.endsWith('ps')
      ? '42 Sat Oct 10 15:29:12 2026 codex'
      : 'n/Applications/ChatGPT.app/Contents/Resources'
  expect((await collectCodex('/codex', io)).sessions).toEqual([])
})

it.each([
  ['the account its rollout names, exactly', { creator_account_id: 'acct_CANARY_ID' }],
  ['no account when its rollout names none', {}]
])('attributes a Codex session to %s', async (_case, creator) => {
  const io = fixtureIo({
    '/codex/sessions/rollout-a.jsonl': JSON.stringify({
      type: 'session_meta',
      payload: { id: 'a', cwd: '/repo', ...creator }
    }),
    '/repo/.git': null
  })
  io.exec = async (file) =>
    file.endsWith('ps') ? '42 Sat Oct 10 15:29:12 2026 /bin/codex' : 'p42\nn/repo\n'
  const [session] = (await collectCodex('/codex', io)).sessions
  const named = 'creator_account_id' in creator
  expect(session.key).toBe('codex:a')
  expect(session.accountKey).toBe(named ? accountKey('codex', 'acct_CANARY_ID') : null)
  expect(session.accountConfidence).toBe(named ? 'exact' : undefined)
  expect(JSON.stringify(session)).not.toContain('CANARY')
})

it('handles current Codex response_item tool and reasoning records without retaining inputs', () => {
  const tool = JSON.stringify({
    type: 'response_item',
    payload: { type: 'custom_tool_call', input: 'SECRET_INPUT' }
  })
  const reasoning = JSON.stringify({
    type: 'response_item',
    payload: { type: 'reasoning', summary: 'SECRET_PROMPT' }
  })
  expect(parseCodexActivity(tool).activity).toBe('running')
  expect(parseCodexActivity(`${tool}\n${reasoning}`).activity).toBe('thinking')
  expect(JSON.stringify(parseCodexActivity(tool))).not.toContain('SECRET_INPUT')
})

it.each(['/company/repo', '/company/repo/.claude/.worktree/task'])(
  'keeps main project and company identity for %s',
  async (cwd) => {
    const io = fixtureIo({
      '/company/repo/.git': null,
      '/company/repo/.claude/.worktree/task/.git': 'gitdir: /company/repo/.git/worktrees/task\n'
    })
    io.exec = async (file) =>
      file.endsWith('ps') ? '42 Sat Oct 10 15:29:12 2026 codex' : `n${cwd}`
    const batch = await collectCodex('/codex', io)
    expect(batch.sessions[0]).toMatchObject({
      projectRoot: '/company/repo',
      projectLabel: 'repo',
      companyLabel: 'company',
      worktree: cwd === '/company/repo' ? null : cwd
    })
  }
)
