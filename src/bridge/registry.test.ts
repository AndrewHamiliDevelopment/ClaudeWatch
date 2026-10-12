import { describe, expect, it, vi } from 'vitest'
import { collectClaude } from './registry'
import { isLive } from './liveness'
import { listAgentFiles, liveSubagents } from './subagents'
import { fixtureIo, registryEntry, missing } from './__fixtures__/helpers'

const root = '/claude'
const entry = registryEntry()
const file = `${root}/sessions/42.json`

describe('Claude registry', () => {
  it('drops reused pids and never reads sibling keys', async () => {
    const io = fixtureIo({
      [file]: JSON.stringify(entry),
      [`${root}/sessions/42.key`]: 'DO_NOT_READ'
    })
    io.exec = vi.fn(async () => 'Sun Oct 11 15:29:12 2026')
    const read = vi.spyOn(io, 'readText')
    const batch = await collectClaude([root], io, 1000)
    expect(batch.sessions).toEqual([])
    expect(batch.sources[0].ok).toBe(true)
    expect(read.mock.calls.flat().some((path) => path.endsWith('.key'))).toBe(false)
    expect(io.exec).toHaveBeenCalledWith('/bin/ps', ['-o', 'lstart=', '-p', '42'])
  })
  it('proves a session live from the process table without asking ps about its pid', async () => {
    const io = fixtureIo({ [file]: JSON.stringify(entry), '/repo/.git': null })
    const exec = vi.fn(async (_program: string, args: string[]) =>
      args[0] === '-xo' ? `   42 ${entry.procStart} claude\n` : ''
    )
    io.exec = exec
    expect((await collectClaude([root], io, 1000)).sessions).toHaveLength(1)
    expect(exec.mock.calls.filter(([, args]) => args.includes('lstart='))).toEqual([])
  })
  it('drops a pid the process table lists under another start time, without a second ask', async () => {
    const io = fixtureIo({ [file]: JSON.stringify(entry), '/repo/.git': null })
    const exec = vi.fn(async (_program: string, args: string[]) =>
      args[0] === '-xo' ? '   42 Sun Oct 11 15:29:12 2026 claude\n' : entry.procStart
    )
    io.exec = exec
    expect((await collectClaude([root], io, 1000)).sessions).toEqual([])
    expect(exec.mock.calls.filter(([, args]) => args.includes('lstart='))).toEqual([])
  })
  it('reads a transcript tail again only when the file changed, and afresh for a session that came back', async () => {
    const transcript = `${root}/projects/-repo/a.jsonl`
    const files: Record<string, string | null> = {
      [file]: JSON.stringify(entry),
      '/repo/.git': null,
      [transcript]: 'x\n'
    }
    const io = fixtureIo(files)
    let live = true
    io.exec = async (_program, args) => (args.includes('lstart=') && live ? entry.procStart : '')
    const readTail = vi.spyOn(io, 'readTail')
    await collectClaude([root], io, 1000)
    await collectClaude([root], io, 3000)
    expect(readTail).toHaveBeenCalledTimes(1)
    files[transcript] += 'y\n'
    await collectClaude([root], io, 5000)
    expect(readTail).toHaveBeenCalledTimes(2)
    live = false
    await collectClaude([root], io, 7000)
    live = true
    await collectClaude([root], io, 9000)
    expect(readTail).toHaveBeenCalledTimes(3)
  })
  it('looks for a folder’s project once a minute, not on every tick', async () => {
    const io = fixtureIo({ [file]: JSON.stringify(entry), '/repo/.git': null })
    io.exec = async (_program, args) => (args.includes('lstart=') ? entry.procStart : '')
    const stat = vi.spyOn(io, 'stat')
    const lookups = (): number => stat.mock.calls.filter(([path]) => path === '/repo/.git').length
    await collectClaude([root], io, 1000)
    await collectClaude([root], io, 3000)
    expect(lookups()).toBe(1)
    await collectClaude([root], io, 61_000)
    expect(lookups()).toBe(2)
  })
  it('collects sessions side by side and still lists them in registry order', async () => {
    const io = fixtureIo({
      [file]: JSON.stringify(entry),
      [`${root}/sessions/43.json`]: JSON.stringify({ ...entry, pid: 43, sessionId: 'b' }),
      '/repo/.git': null,
      [`${root}/projects/-repo/a.jsonl`]: '',
      [`${root}/projects/-repo/b.jsonl`]: ''
    })
    io.exec = async (_program, args) =>
      args[0] === '-xo' ? `42 ${entry.procStart} claude\n43 ${entry.procStart} claude\n` : ''
    // The first session's tail is held back until the second's has been asked for.
    let secondAsked = (): void => {}
    const untilSecondAsked = new Promise<void>((resolve) => (secondAsked = resolve))
    io.readTail = async (path) => {
      if (path.endsWith('/b.jsonl')) secondAsked()
      else await untilSecondAsked
      return ''
    }
    const batch = await collectClaude([root], io, 1000)
    expect(batch.sessions.map((session) => session.sessionId)).toEqual(['a', 'b'])
  })
  it('treats a missing root as healthy and empty', async () => {
    const batch = await collectClaude([root], fixtureIo(), 1000)
    expect(batch.sessions).toEqual([])
    expect(batch.sources).toEqual([{ id: `claude:${root}`, ok: true, detail: 'empty' }])
  })
  it('ingests live entries, fallback transcripts and permission attention', async () => {
    const waiting = {
      ...entry,
      status: 'waiting',
      waitingFor: 'approval requested',
      statusUpdatedAt: '2026-10-11T00:00:00Z'
    }
    const io = fixtureIo({
      [file]: JSON.stringify(waiting),
      '/repo/.git': null,
      '/claude/projects/old/a.jsonl': ''
    })
    io.exec = async () => ' Sat  Oct 10 15:29:12 2026 '
    const batch = await collectClaude([root], io, 1000)
    expect(batch.sessions[0]).toMatchObject({
      attention: 'permission',
      projectLabel: 'repo',
      currentTool: null
    })
  })
  it('skips malformed entries and marks inaccessible roots unhealthy', async () => {
    const io = fixtureIo({
      [file]: '{',
      '/claude/sessions/43.json': JSON.stringify({ ...entry, sessionId: '../unsafe' })
    })
    expect((await collectClaude([root], io, 1000)).sessions).toEqual([])
    io.list = async () => {
      throw Object.assign(new Error('denied'), { code: 'EACCES' })
    }
    expect((await collectClaude([root], io, 1000)).sources[0].ok).toBe(false)
  })
  it('collapses whitespace in starts and treats missing pids as dead', async () => {
    const io = fixtureIo()
    io.exec = async () => 'Sat  Oct 10 15:29:12 2026\n'
    expect(await isLive(entry, io, [])).toBe(true)
    io.exec = async () => {
      throw missing()
    }
    expect(await isLive(entry, io, [])).toBe(false)
  })
})

describe('agent teams', () => {
  const lead = '6a654bca-1111-2222-3333-444444444444'
  const team = 'session-6a654bca'
  const transcript = `${root}/projects/-repo/${lead}.jsonl`
  const files = {
    [file]: JSON.stringify({ ...entry, sessionId: lead }),
    '/repo/.git': null,
    [transcript]: '',
    [`${root}/projects/-repo/${lead}/subagents/agent-abc.jsonl`]: '',
    [`${root}/projects/-repo/${lead}/subagents/agent-abc.meta.json`]: '{"agentType":"Explore"}',
    [`${root}/projects/-repo/mate.jsonl`]: `${JSON.stringify({ teamName: team, agentName: 'lena-b0' })}\n`,
    [`${root}/projects/-repo/mate/subagents/agent-xyz.jsonl`]: '',
    [`${root}/teams/${team}/config.json`]: JSON.stringify({
      leadSessionId: lead,
      members: [
        { agentId: `team-lead@${team}`, name: 'team-lead', agentType: 'team-lead' },
        {
          agentId: `lena-b0@${team}`,
          name: 'lena-b0',
          agentType: 'lena',
          cwd: '/repo',
          joinedAt: 1
        }
      ]
    })
  }
  const table = `93143 ${entry.procStart} /versions/2.1.296 --agent-id lena-b0@${team} --parent-session-id ${lead}`

  it('reports a live teammate under its lead, though it has no registry file of its own', async () => {
    const io = fixtureIo(files)
    const exec = vi.fn(async (_file: string, args: string[]) =>
      args[0] === '-xo' ? table : entry.procStart
    )
    io.exec = exec
    const batch = await collectClaude([root], io, 2000)
    expect(batch.sessions).toHaveLength(1)
    expect(batch.sessions[0].usage).toBeNull()
    expect(batch.sessions[0].subagents).toEqual([
      { id: 'abc', type: 'Explore', activity: 'thinking' },
      {
        id: `lena-b0@${team}`,
        type: 'lena',
        activity: 'thinking',
        kind: 'teammate',
        name: 'lena-b0',
        cwd: '/repo',
        pid: 93143,
        startedAtMs: Date.parse(`${entry.procStart} UTC`),
        orcaPaneKey: null,
        tokens: null
      }
    ])
    expect(batch.transcripts.get(`claude:${lead}`)).toEqual({
      main: transcript,
      agents: [
        {
          id: 'abc',
          path: `${root}/projects/-repo/${lead}/subagents/agent-abc.jsonl`,
          size: 0,
          mtimeMs: 1000
        }
      ],
      // The teammate's own transcript, then those of the agents it spawned.
      teammates: new Map([
        [
          `lena-b0@${team}`,
          [
            `${root}/projects/-repo/mate.jsonl`,
            `${root}/projects/-repo/mate/subagents/agent-xyz.jsonl`
          ]
        ]
      ])
    })
    // One process table serves every lead in the tick.
    expect(exec.mock.calls.filter(([, args]) => args[0] === '-xo')).toHaveLength(1)
  })
  it('keeps the lead when its team cannot be read, and says so', async () => {
    const io = fixtureIo(files)
    io.exec = async (_file, args) => {
      if (args[0] === '-xo') throw new Error('timeout')
      return entry.procStart
    }
    const batch = await collectClaude([root], io, 2000)
    expect(batch.sessions[0].subagents).toEqual([
      { id: 'abc', type: 'Explore', activity: 'thinking' }
    ])
    expect(batch.sources[0]).toEqual({
      id: `claude:${root}`,
      ok: false,
      detail: 'team read failed'
    })
  })
  it('still says the team read failed when a later session of the same root reads fine', async () => {
    const io = fixtureIo({
      ...files,
      [`${root}/sessions/43.json`]: JSON.stringify({ ...entry, pid: 43, sessionId: 'plain' })
    })
    io.exec = async (_file, args) => {
      if (args[0] === '-xo') throw new Error('timeout')
      return entry.procStart
    }
    const batch = await collectClaude([root], io, 2000)
    expect(batch.sessions.map((session) => session.sessionId)).toEqual([lead, 'plain'])
    expect(batch.sources[0]).toEqual({
      id: `claude:${root}`,
      ok: false,
      detail: 'team read failed'
    })
  })

  describe('a teammate whose lead has exited', () => {
    // The lead's registry file is gone; its roster and its teammate's process are not.
    const orphaned = { ...files, [file]: null as unknown as string }
    delete (orphaned as Record<string, unknown>)[file]
    const key = `claude:lena-b0@${team}`

    it('is shown as a session of its own, with its own process, folder and transcripts', async () => {
      const io = fixtureIo(orphaned)
      io.exec = async (_file, args) => (args[0] === '-xo' ? table : entry.procStart)
      const batch = await collectClaude([root], io, 2000)
      expect(batch.sessions).toHaveLength(1)
      expect(batch.sessions[0]).toMatchObject({
        key,
        provider: 'claude',
        pid: 93143,
        name: 'lena-b0',
        cwd: '/repo',
        projectLabel: 'repo',
        activity: 'thinking',
        attention: 'none',
        subagents: [],
        startedAtMs: Date.parse(`${entry.procStart} UTC`)
      })
      expect(batch.transcripts.get(key)).toEqual({
        main: `${root}/projects/-repo/mate.jsonl`,
        agents: [
          {
            id: 'xyz',
            path: `${root}/projects/-repo/mate/subagents/agent-xyz.jsonl`,
            size: 0,
            mtimeMs: 1000
          }
        ],
        teammates: new Map()
      })
      expect(batch.sources[0].ok).toBe(true)
    })

    it('is not shown twice while its lead lives', async () => {
      const io = fixtureIo(files)
      io.exec = async (_file, args) => (args[0] === '-xo' ? table : entry.procStart)
      const batch = await collectClaude([root], io, 2000)
      expect(batch.sessions.map((session) => session.key)).toEqual([`claude:${lead}`])
    })

    it('is looked for only under a parent id that is a session id', async () => {
      const io = fixtureIo(orphaned)
      const read = vi.spyOn(io, 'readText')
      io.exec = async (_file, args) =>
        args[0] === '-xo'
          ? `93143 ${entry.procStart} /versions/2.1.296 --agent-id x@y --parent-session-id ../../..`
          : entry.procStart
      expect((await collectClaude([root], io, 2000)).sessions).toEqual([])
      expect(read.mock.calls.flat().every((path) => !path.includes('..'))).toBe(true)
      expect(read.mock.calls.flat().some((path) => path.includes('/teams/'))).toBe(false)
    })

    it('is not guessed at while the registry itself cannot be read', async () => {
      const io = fixtureIo(orphaned)
      io.exec = async (_file, args) => (args[0] === '-xo' ? table : entry.procStart)
      const list = io.list
      io.list = async (path) => {
        if (path === `${root}/sessions`)
          throw Object.assign(new Error('denied'), { code: 'EACCES' })
        return list(path)
      }
      const batch = await collectClaude([root], io, 2000)
      expect(batch.sessions).toEqual([])
      expect(batch.sources[0].ok).toBe(false)
    })
  })
})

describe('subagents', () => {
  it('keeps only fresh id and agent type, excluding descriptions', async () => {
    const io = fixtureIo({
      '/t/subagents/agent-abc.meta.json': JSON.stringify({
        agentType: 'Explore',
        description: 'PRIVATE_DESCRIPTION'
      }),
      '/t/subagents/agent-abc.jsonl': 'PRIVATE_TRANSCRIPT',
      '/t/subagents/agent-old.meta.json': '{}'
    })
    const files = await listAgentFiles('/t.jsonl', io)
    expect(await liveSubagents(files, io, 2000)).toEqual([
      { id: 'abc', type: 'Explore', activity: 'thinking' }
    ])
    expect(await liveSubagents(files, io, 62000)).toEqual([])
  })
  it('shows what a subagent is doing from the open tool at the end of its transcript', async () => {
    const opened = (name: string) =>
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: `t-${name}`, name, input: {} }] }
      })
    const meta = JSON.stringify({ agentType: 'ravi' })
    const io = fixtureIo({
      '/t/subagents/agent-e.meta.json': meta,
      '/t/subagents/agent-e.jsonl': opened('Edit'),
      '/t/subagents/agent-r.meta.json': meta,
      '/t/subagents/agent-r.jsonl': opened('Read'),
      '/t/subagents/agent-b.meta.json': meta,
      '/t/subagents/agent-b.jsonl': opened('Bash')
    })
    const files = await listAgentFiles('/t.jsonl', io)
    expect(await liveSubagents(files, io, 2000)).toEqual([
      { id: 'b', type: 'ravi', activity: 'running' },
      { id: 'e', type: 'ravi', activity: 'editing' },
      { id: 'r', type: 'ravi', activity: 'reading' }
    ])
  })
  it('keeps a quiet subagent live while a tool it opened is still running, up to a cap', async () => {
    const io = fixtureIo({
      '/t/subagents/agent-b.meta.json': JSON.stringify({ agentType: 'ravi' }),
      '/t/subagents/agent-b.jsonl': JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }] }
      }),
      '/t/subagents/agent-q.meta.json': JSON.stringify({ agentType: 'maya' }),
      '/t/subagents/agent-q.jsonl': 'PRIVATE_TRANSCRIPT'
    })
    const files = await listAgentFiles('/t.jsonl', io)
    expect(await liveSubagents(files, io, 1000 + 5 * 60_000)).toEqual([
      { id: 'b', type: 'ravi', activity: 'running' }
    ])
    expect(await liveSubagents(files, io, 1000 + 16 * 60_000)).toEqual([])
  })
  it('reads nothing more for a held subagent whose transcript has not moved', async () => {
    const io = fixtureIo({
      '/t/subagents/agent-b.meta.json': JSON.stringify({ agentType: 'ravi' }),
      '/t/subagents/agent-b.jsonl': JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: {} }] }
      })
    })
    const files = await listAgentFiles('/t.jsonl', io)
    await liveSubagents(files, io, 1000 + 5 * 60_000)
    const stat = vi.spyOn(io, 'stat')
    const readText = vi.spyOn(io, 'readText')
    const readTail = vi.spyOn(io, 'readTail')
    expect(await liveSubagents(files, io, 1000 + 6 * 60_000)).toEqual([
      { id: 'b', type: 'ravi', activity: 'running' }
    ])
    expect([stat, readText, readTail].map((spy) => spy.mock.calls.length)).toEqual([0, 0, 0])
  })
  it('keeps a subagent written a moment after the tick began', async () => {
    const io = fixtureIo({
      '/t/subagents/agent-a.meta.json': JSON.stringify({ agentType: 'ravi' }),
      '/t/subagents/agent-a.jsonl': 'x'
    })
    const files = await listAgentFiles('/t.jsonl', io)
    expect(await liveSubagents(files, io, 0)).toEqual([
      { id: 'a', type: 'ravi', activity: 'thinking' }
    ])
  })
  it('finds workflow agents beside plain ones and skips journals and stray files', async () => {
    const meta = (agentType: string) => JSON.stringify({ agentType })
    const io = fixtureIo({
      '/t/subagents/agent-abc.meta.json': meta('Explore'),
      '/t/subagents/agent-abc.jsonl': 'four',
      '/t/subagents/agent-abc.forked-skill.json': '{}',
      '/t/subagents/workflows/wf_1/agent-def.meta.json': meta('general-purpose'),
      '/t/subagents/workflows/wf_1/agent-def.jsonl': 'sixsix',
      '/t/subagents/workflows/wf_1/journal.jsonl': 'PRIVATE_JOURNAL',
      '/t/subagents/workflows/stray': 'not a folder'
    })
    const files = await listAgentFiles('/t.jsonl', io)
    expect(files).toEqual([
      { id: 'abc', path: '/t/subagents/agent-abc.jsonl', size: 4, mtimeMs: 1000 },
      { id: 'def', path: '/t/subagents/workflows/wf_1/agent-def.jsonl', size: 6, mtimeMs: 1000 }
    ])
    expect(await liveSubagents(files, io, 2000)).toEqual([
      { id: 'abc', type: 'Explore', activity: 'thinking' },
      { id: 'def', type: 'general-purpose', activity: 'thinking' }
    ])
    expect(await listAgentFiles('/none.jsonl', io)).toEqual([])
  })
})

it.each(['/company/repo', '/company/repo/.claude/.worktree/task'])(
  'keeps main project and company identity for %s',
  async (cwd) => {
    const io = fixtureIo({
      '/company/repo/.git': null,
      '/company/repo/.claude/.worktree/task/.git': 'gitdir: /company/repo/.git/worktrees/task\n',
      '/claude/sessions/42.json': JSON.stringify({ ...registryEntry(), cwd })
    })
    io.exec = async () => registryEntry().procStart
    const batch = await collectClaude(['/claude'], io, 1000)
    expect(batch.sessions[0]).toMatchObject({
      projectRoot: '/company/repo',
      projectLabel: 'repo',
      companyLabel: 'company',
      worktree: cwd === '/company/repo' ? null : cwd
    })
  }
)
