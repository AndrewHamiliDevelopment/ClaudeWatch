import { describe, expect, it } from 'vitest'
import { readFile } from 'node:fs/promises'
import { resolveProject } from './project-root'
import { parseTranscript } from './transcript-tail'
import { toolCategory, toolActivity } from './tool-category'
import { reduce, diff, emptySnapshot } from './reducer'
import { sessionFromRegistry } from './claude'
import { fixtureIo, registryEntry, session } from './__fixtures__/helpers'

describe('transcript', () => {
  it('pairs by id, preserves earlier open tools, and drops all content', async () => {
    const tail = await readFile(new URL('./__fixtures__/transcript.jsonl', import.meta.url), 'utf8')
    expect(parseTranscript(tail)).toEqual({
      tool: { name: 'Read', category: 'read' },
      error: true
    })
    const ref = sessionFromRegistry(registryEntry(), parseTranscript(tail), [], '/repo', null)
    expect(JSON.stringify(ref)).not.toMatch(/SECRET_PROMPT|SECRET_INPUT|SECRET_RESULT/)
  })
  it('reports last-tool errors until a new tool starts and ignores malformed lines', () => {
    const use = (id: string) =>
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id, name: 'Bash' }] }
      })
    const result = JSON.stringify({
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'a', is_error: true }] }
    })
    expect(parseTranscript(`${use('a')}\n${result}\nbroken`).error).toBe(true)
    expect(parseTranscript(`${use('a')}\n${result}\n${use('b')}`).error).toBe(false)
  })
  it.each([
    ['Read', 'read', 'reading'],
    ['Grep', 'read', 'reading'],
    ['NotebookEdit', 'edit', 'editing'],
    ['BashOutput', 'run', 'running'],
    ['WebFetch', 'web', 'searching'],
    ['Agent', 'agent', 'delegating'],
    ['custom', 'other', 'running']
  ])('maps %s', (name, category, activity) => {
    expect(toolCategory(name)).toBe(category)
    expect(toolActivity(toolCategory(name))).toBe(activity)
  })
})

describe('project roots', () => {
  it('walks to a normal repo', async () => {
    const io = fixtureIo({ '/repo/.git': null })
    expect(await resolveProject('/repo/src', io)).toEqual({ root: '/repo', worktree: null })
  })
  it('resolves a worktree gitdir and keeps its own top directory', async () => {
    const io = fixtureIo({
      '/repo/.claude/.worktree/feature/.git': 'gitdir: /repo/.git/worktrees/feature\n'
    })
    expect(await resolveProject('/repo/.claude/.worktree/feature/src', io)).toEqual({
      root: '/repo',
      worktree: '/repo/.claude/.worktree/feature'
    })
  })
  it('uses cwd for non-repositories', async () => {
    expect(await resolveProject('/plain', fixtureIo())).toEqual({ root: '/plain', worktree: null })
  })
})

describe('reducer and diff', () => {
  it('upserts changed/new sessions and removes absent ones', () => {
    const prev = reduce(emptySnapshot(), {
      now: 10,
      sessions: [session('a'), session('b')],
      sources: []
    })
    const changed = { ...session('a'), activity: 'reading' as const }
    const next = reduce(prev, { now: 20, sessions: [changed, session('c')], sources: [] })
    expect(next.rev).toBe(2)
    expect(diff(prev, next, 3)).toEqual({
      type: 'patch',
      v: 1,
      seq: 3,
      upserts: [changed, session('c')],
      removed: ['claude:b']
    })
    expect(diff(next, next, 4)).toEqual({ type: 'patch', v: 1, seq: 4, upserts: [], removed: [] })
  })
  it('marks busy to idle done for two minutes, without sliding expiry', () => {
    const prev = reduce(emptySnapshot(), {
      now: 1000,
      sessions: [{ ...session('a'), activity: 'thinking' }],
      sources: []
    })
    const idle = { ...session('a'), updatedAtMs: 2000 }
    const next = reduce(prev, { now: 2000, sessions: [idle], sources: [] })
    expect(next.sessions[0].attention).toBe('done')
    expect(reduce(next, { now: 3000, sessions: [idle], sources: [] }).sessions[0].attention).toBe(
      'done'
    )
    expect(reduce(next, { now: 123000, sessions: [idle], sources: [] }).sessions[0].attention).toBe(
      'none'
    )
  })
})

it('keeps last-tool errors when an older parallel tool remains open', () => {
  const tail = [
    {
      type: 'assistant',
      message: {
        content: [
          { type: 'tool_use', id: 'a', name: 'Read' },
          { type: 'tool_use', id: 'b', name: 'Edit' }
        ]
      }
    },
    {
      type: 'user',
      message: { content: [{ type: 'tool_result', tool_use_id: 'b', is_error: true }] }
    }
  ]
    .map((line) => JSON.stringify(line))
    .join('\n')
  expect(parseTranscript(tail).error).toBe(true)
})
it('unknown tool names cannot access inherited category entries', () => {
  expect(toolCategory('constructor')).toBe('other')
  expect(toolCategory('toString')).toBe('other')
})
it('registry idle status overrides unfinished tools from the bounded tail', () => {
  const ref = sessionFromRegistry(
    { ...registryEntry(), status: 'idle' },
    { tool: { name: 'Bash', category: 'run' }, error: false },
    [],
    '/repo',
    null
  )
  expect(ref.activity).toBe('idle')
})

it('clears failed-tool attention when Claude becomes idle', () => {
  const ref = sessionFromRegistry(
    { ...registryEntry(), status: 'idle' },
    { tool: null, error: true },
    [],
    '/company/repo',
    '/company/repo/.claude/.worktree/task'
  )
  expect(ref.attention).toBe('none')
  expect(ref).toMatchObject({
    projectRoot: '/company/repo',
    projectLabel: 'repo',
    companyLabel: 'company'
  })
})
