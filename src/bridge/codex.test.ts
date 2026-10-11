import { expect, it, vi } from 'vitest'
import { collectCodex, parseCodexProcesses, parseCodexActivity } from './codex'
import { fixtureIo } from './__fixtures__/helpers'

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
    '/codex/sessions/2026/10/rollout-new.jsonl': `${meta('new', '/repo')}\n${JSON.stringify({ type: 'event_msg', payload: { type: 'reasoning', text: 'SECRET_PROMPT' } })}`,
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
    projectLabel: 'repo'
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
    projectLabel: 'plain'
  })
  io.exec = async () => {
    throw new Error('denied')
  }
  expect((await collectCodex('/codex', io)).sources[0].ok).toBe(false)
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
