import { expect, it, vi } from 'vitest'
import { PROCESS_TABLE_ARGS } from './process-table'
import { parseTeammateProcesses, TeammateSource, type TeammateProcess } from './teammates'
import { fixtureIo } from './__fixtures__/helpers'

const lead = '6a654bca-1111-2222-3333-444444444444'
const team = 'session-6a654bca'
const start = 'Sun Oct 11 11:45:19 2026'
const startedAtMs = Date.parse(`${start} UTC`)
const roster = `/claude/teams/${team}/config.json`
const folder = '/claude/projects/-work-repo'

function member(name: string, extra: Record<string, unknown> = {}) {
  return {
    agentId: `${name}@${team}`,
    name,
    agentType: name.split('-')[0],
    joinedAt: 5000,
    tmuxPaneId: '%17',
    cwd: '/work/repo',
    backendType: 'tmux',
    prompt: 'CANARY_PROMPT',
    ...extra
  }
}
function config(members: unknown[], leadSessionId = lead): string {
  return JSON.stringify({
    name: team,
    createdAt: 1000,
    leadAgentId: `team-lead@${team}`,
    leadSessionId,
    members: [
      {
        agentId: `team-lead@${team}`,
        name: 'team-lead',
        agentType: 'team-lead',
        cwd: '/work/repo'
      },
      ...members
    ]
  })
}
const alive = (name: string, pid: number, parentSessionId = lead): TeammateProcess => ({
  pid,
  startedAtMs,
  agentId: `${name}@${team}`,
  parentSessionId
})
const record = (value: Record<string, unknown>): string => `${JSON.stringify(value)}\n`
// As on disk: small setting records, then a large first record that names the team and agent.
function transcript(name: string, tail = ''): string {
  return (
    record({ type: 'agent-setting', agentSetting: 'x' }) +
    record({ type: 'mode', mode: 'default' }) +
    record({
      type: 'attachment',
      teamName: team,
      agentName: name,
      attachment: { text: 'CANARY_ATTACHMENT'.repeat(5000) }
    }) +
    tail
  )
}
// How many times the project folder itself was listed, which is what a transcript search costs.
const searches = (list: { mock: { calls: unknown[][] } }): number =>
  list.mock.calls.filter(([path]) => path === folder).length
const toolUse = record({
  type: 'assistant',
  message: { content: [{ type: 'tool_use', id: 't1', name: 'Bash', input: 'CANARY_INPUT' }] }
})

it('reads agent id and parent session from process rows and nothing else', () => {
  const rows = [
    `93143 ${start} /versions/2.1.296 --agent-id lena-b0@${team} --agent-name lena-b0 --team-name ${team} --agent-color blue --parent-session-id ${lead} --agent-type lena --model opus SECRET=hidden`,
    `93144 ${start} /versions/2.1.296 --agent-id orphan@${team}`,
    `93145 ${start} /versions/2.1.296 --parent-session-id ${lead}`,
    `93146 ${start} /versions/2.1.296 --resume`
  ].join('\n')
  expect(parseTeammateProcesses(rows)).toEqual([
    { pid: 93143, startedAtMs, agentId: `lena-b0@${team}`, parentSessionId: lead }
  ])
})

it('keeps roster members whose process is alive under this lead, as teammates', async () => {
  const io = fixtureIo({
    [roster]: config([member('lena-b0'), member('ravi-b4'), member('kai-b6')])
  })
  const source = new TeammateSource(io)
  const processes = async () => [
    alive('lena-b0', 93143),
    alive('kai-b6', 93150, 'another-lead-session'),
    alive('stranger', 93151)
  ]
  const teammates = await source.collect('/claude', lead, '/work/repo', processes, 6000)
  expect(teammates).toEqual([
    {
      transcripts: [],
      ref: {
        id: `lena-b0@${team}`,
        type: 'lena',
        activity: 'thinking',
        kind: 'teammate',
        name: 'lena-b0',
        cwd: '/work/repo',
        pid: 93143,
        startedAtMs,
        orcaPaneKey: null,
        tokens: null
      }
    }
  ])
  expect(JSON.stringify(teammates)).not.toContain('CANARY')
})

it('does not look at processes when the session leads no team, or the roster is another lead’s', async () => {
  const processes = vi.fn(async () => [alive('lena-b0', 93143)])
  expect(
    await new TeammateSource(fixtureIo()).collect('/claude', lead, '/work/repo', processes, 6000)
  ).toEqual([])
  const io = fixtureIo({ [roster]: config([member('lena-b0')], '6a654bca-ffff-other-lead') })
  expect(
    await new TeammateSource(io).collect('/claude', lead, '/work/repo', processes, 6000)
  ).toEqual([])
  const broken = fixtureIo({ [roster]: '{' })
  expect(
    await new TeammateSource(broken).collect('/claude', lead, '/work/repo', processes, 6000)
  ).toEqual([])
  expect(processes).not.toHaveBeenCalled()
})

it('skips roster members with unsafe ids or names', async () => {
  const io = fixtureIo({
    [roster]: config([
      member('lena-b0', { agentId: '../../etc@x y' }),
      member('ravi-b4', { name: 42 }),
      member('kai-b6', { agentType: null }),
      'not an object'
    ])
  })
  const processes = async () => [alive('ravi-b4', 1), alive('kai-b6', 2)]
  expect(
    await new TeammateSource(io).collect('/claude', lead, '/work/repo', processes, 6000)
  ).toEqual([])
})

it('ties a teammate to the newest transcript naming its team and agent, and reads activity from its tail', async () => {
  const files: Record<string, string> = {
    [roster]: config([member('lena-b0')]),
    [`${folder}/old.jsonl`]: transcript('lena-b0'),
    [`${folder}/mine.jsonl`]: transcript('lena-b0', toolUse),
    [`${folder}/newer-other-agent.jsonl`]: transcript('ravi-b4'),
    [`${folder}/plain-session.jsonl`]: record({ type: 'user', message: { content: 'hello' } }),
    [`${folder}/before-joining.jsonl`]: transcript('lena-b0'),
    [`${folder}/mine/subagents/agent-abc.jsonl`]: transcript('lena-b0')
  }
  const io = fixtureIo(files)
  const mtimes: Record<string, number> = {
    [`${folder}/old.jsonl`]: 6000,
    [`${folder}/mine.jsonl`]: 8000,
    [`${folder}/newer-other-agent.jsonl`]: 9000,
    [`${folder}/plain-session.jsonl`]: 9000,
    [`${folder}/before-joining.jsonl`]: 4000
  }
  const stat = io.stat
  io.stat = async (path) => ({ ...(await stat(path)), mtimeMs: mtimes[path] ?? 1000 })
  const source = new TeammateSource(io)
  const processes = async () => [alive('lena-b0', 93143)]
  const [teammate] = await source.collect('/claude', lead, '/work/repo', processes, 10000)
  // Its own transcript first, then those of the agents it spawned itself.
  expect(teammate.transcripts).toEqual([
    `${folder}/mine.jsonl`,
    `${folder}/mine/subagents/agent-abc.jsonl`
  ])
  expect(teammate.ref.activity).toBe('running')
  expect(JSON.stringify(teammate)).not.toContain('CANARY')

  // Once tied, the folder is looked at again only later, in case a newer transcript took over.
  const list = vi.spyOn(io, 'list')
  files[`${folder}/mine.jsonl`] = transcript('lena-b0')
  const at = async (now: number): Promise<string> =>
    (await source.collect('/claude', lead, '/work/repo', processes, now))[0].ref.activity
  expect(await at(12000)).toBe('thinking')
  expect(searches(list)).toBe(0)
  expect(await at(70000)).toBe('idle')
  expect(searches(list)).toBe(1)
})

it('shows a teammate as thinking while no transcript can be tied, and searches again only every 10 s', async () => {
  const files: Record<string, string> = {
    [roster]: config([member('lena-b0', { joinedAt: 500 })])
  }
  const io = fixtureIo(files)
  const list = vi.spyOn(io, 'list')
  const source = new TeammateSource(io)
  const processes = async () => [alive('lena-b0', 93143)]
  for (const now of [6000, 8000, 15999]) {
    const [teammate] = await source.collect('/claude', lead, '/work/repo', processes, now)
    expect(teammate).toMatchObject({ transcripts: [], ref: { activity: 'thinking' } })
  }
  expect(searches(list)).toBe(1)
  files[`${folder}/mine.jsonl`] = transcript('lena-b0')
  const [teammate] = await source.collect('/claude', lead, '/work/repo', processes, 16000)
  expect(teammate.transcripts).toEqual([`${folder}/mine.jsonl`])
  expect(searches(list)).toBe(2)
})

it('forgets teammates that left, so a restarted one is searched for afresh', async () => {
  const io = fixtureIo({
    [roster]: config([member('lena-b0', { joinedAt: 500 })]),
    [`${folder}/mine.jsonl`]: transcript('lena-b0')
  })
  const source = new TeammateSource(io)
  const [tied] = await source.collect(
    '/claude',
    lead,
    '/work/repo',
    async () => [alive('lena-b0', 93143)],
    6000
  )
  expect(tied.transcripts).toEqual([`${folder}/mine.jsonl`])
  source.prune()
  await source.collect('/claude', lead, '/work/repo', async () => [], 8000)
  source.prune()
  const list = vi.spyOn(io, 'list')
  await source.collect('/claude', lead, '/work/repo', async () => [alive('lena-b0', 93143)], 10000)
  expect(searches(list)).toBe(1)
})

it('lists the owner’s own processes only, not every account’s', () => {
  expect(PROCESS_TABLE_ARGS).toEqual(['-xo', 'pid=,lstart=,command='])
})

it('counts a member only when its process carries the id made of its own name and the team', async () => {
  const io = fixtureIo({
    [roster]: config([
      // Another agent's process under this member's name.
      member('ravi-b4', { agentId: `lena-b0@${team}` }),
      // A name the roster pairs with an id from elsewhere.
      member('kai-b6', { agentId: `kai-b6@session-other` })
    ])
  })
  const processes = async () => [
    alive('lena-b0', 93143),
    { ...alive('kai-b6', 93150), agentId: 'kai-b6@session-other' }
  ]
  expect(
    await new TeammateSource(io).collect('/claude', lead, '/work/repo', processes, 6000)
  ).toEqual([])
})

it('carries a teammate’s own folder, and searches its lead’s folder when the roster names none', async () => {
  const io = fixtureIo({
    [roster]: config([
      member('lena-b0', { cwd: '/work/repo-wt' }),
      member('ravi-b4', { cwd: undefined })
    ]),
    '/claude/projects/-work-repo-wt/lena.jsonl': transcript('lena-b0'),
    [`${folder}/ravi.jsonl`]: transcript('ravi-b4')
  })
  const stat = io.stat
  io.stat = async (path) => ({ ...(await stat(path)), mtimeMs: 6000 })
  const processes = async () => [alive('lena-b0', 93143), alive('ravi-b4', 93144)]
  const [lena, ravi] = await new TeammateSource(io).collect(
    '/claude',
    lead,
    '/work/repo',
    processes,
    7000
  )
  expect(lena.ref.cwd).toBe('/work/repo-wt')
  expect(lena.transcripts).toEqual(['/claude/projects/-work-repo-wt/lena.jsonl'])
  expect('cwd' in ravi.ref).toBe(false)
  expect(ravi.transcripts).toEqual([`${folder}/ravi.jsonl`])
})

it('does not tie a re-spawned teammate to the transcript of the one it replaced', async () => {
  // ravi joined at 1000 and has no transcript yet. maya ran once (last write 3000), was shut
  // down, and joined again under the same name at 5000; her new transcript is not there yet.
  const files: Record<string, string> = {
    [roster]: config([member('ravi', { joinedAt: 1000 }), member('maya', { joinedAt: 5000 })]),
    [`${folder}/old-maya.jsonl`]: transcript('maya')
  }
  const io = fixtureIo(files)
  const mtimes: Record<string, number> = {
    [`${folder}/old-maya.jsonl`]: 3000,
    [`${folder}/new-maya.jsonl`]: 9000
  }
  const stat = io.stat
  io.stat = async (path) => ({ ...(await stat(path)), mtimeMs: mtimes[path] ?? 1000 })
  const source = new TeammateSource(io)
  const processes = async () => [alive('ravi', 100), alive('maya', 200)]
  const maya = async (now: number): Promise<string[]> =>
    (await source.collect('/claude', lead, '/work/repo', processes, now)).find(
      (teammate) => teammate.ref.name === 'maya'
    )!.transcripts

  expect(await maya(6000)).toEqual([])
  files[`${folder}/new-maya.jsonl`] = transcript('maya')
  expect(await maya(60000)).toEqual([`${folder}/new-maya.jsonl`])
})

it('moves a tie to a newer transcript that names the same teammate', async () => {
  const files: Record<string, string> = {
    [roster]: config([member('lena-b0', { joinedAt: 500 })]),
    [`${folder}/first.jsonl`]: transcript('lena-b0')
  }
  const io = fixtureIo(files)
  const mtimes: Record<string, number> = { [`${folder}/second.jsonl`]: 9000 }
  const stat = io.stat
  io.stat = async (path) => ({ ...(await stat(path)), mtimeMs: mtimes[path] ?? 6000 })
  const source = new TeammateSource(io)
  const processes = async () => [alive('lena-b0', 93143)]
  const tied = async (now: number): Promise<string[]> =>
    (await source.collect('/claude', lead, '/work/repo', processes, now))[0].transcripts

  expect(await tied(7000)).toEqual([`${folder}/first.jsonl`])
  files[`${folder}/second.jsonl`] = transcript('lena-b0')
  expect(await tied(9500)).toEqual([`${folder}/first.jsonl`])
  expect(await tied(17000)).toEqual([`${folder}/second.jsonl`])
})

it('looks less and less often for a transcript that does not turn up, down to every five minutes', async () => {
  const io = fixtureIo({
    [roster]: config([member('lena-b0', { joinedAt: 500 })]),
    [`${folder}/someone-else.jsonl`]: transcript('ravi-b4')
  })
  const list = vi.spyOn(io, 'list')
  const source = new TeammateSource(io)
  const processes = async () => [alive('lena-b0', 93143)]
  const searchesBy = async (now: number): Promise<number> => {
    await source.collect('/claude', lead, '/work/repo', processes, now)
    return searches(list)
  }

  expect(await searchesBy(0)).toBe(1)
  expect(await searchesBy(9999)).toBe(1)
  expect(await searchesBy(10000)).toBe(2)
  expect(await searchesBy(29999)).toBe(2)
  expect(await searchesBy(30000)).toBe(3)
  expect(await searchesBy(70000)).toBe(4)
  expect(await searchesBy(150000)).toBe(5)
  expect(await searchesBy(310000)).toBe(6)
  expect(await searchesBy(609999)).toBe(6)
  expect(await searchesBy(610000)).toBe(7)
})

it('reads only as many transcript heads as it takes to find the teammates it is looking for', async () => {
  const files: Record<string, string> = { [roster]: config([member('lena-b0', { joinedAt: 500 })]) }
  const mtimes: Record<string, number> = {}
  for (let age = 0; age < 20; age++) {
    files[`${folder}/other-${age}.jsonl`] = transcript('ravi-b4')
    mtimes[`${folder}/other-${age}.jsonl`] = 5000 - age
  }
  files[`${folder}/mine.jsonl`] = transcript('lena-b0')
  mtimes[`${folder}/mine.jsonl`] = 6000
  const io = fixtureIo(files)
  const stat = io.stat
  io.stat = async (path) => ({ ...(await stat(path)), mtimeMs: mtimes[path] ?? 1000 })
  const heads = vi.spyOn(io, 'readFrom')
  const [teammate] = await new TeammateSource(io).collect(
    '/claude',
    lead,
    '/work/repo',
    async () => [alive('lena-b0', 93143)],
    7000
  )
  expect(teammate.transcripts).toEqual([`${folder}/mine.jsonl`])
  expect(heads).toHaveBeenCalledTimes(1)
})
