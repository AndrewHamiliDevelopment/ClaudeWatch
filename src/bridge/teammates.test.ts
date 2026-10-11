import { expect, it, vi } from 'vitest'
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
  const teammates = await source.collect('/claude', lead, processes, 6000)
  expect(teammates).toEqual([
    {
      transcripts: [],
      ref: {
        id: `lena-b0@${team}`,
        type: 'lena',
        activity: 'thinking',
        kind: 'teammate',
        name: 'lena-b0',
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
  expect(await new TeammateSource(fixtureIo()).collect('/claude', lead, processes, 6000)).toEqual(
    []
  )
  const io = fixtureIo({ [roster]: config([member('lena-b0')], '6a654bca-ffff-other-lead') })
  expect(await new TeammateSource(io).collect('/claude', lead, processes, 6000)).toEqual([])
  const broken = fixtureIo({ [roster]: '{' })
  expect(await new TeammateSource(broken).collect('/claude', lead, processes, 6000)).toEqual([])
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
  expect(await new TeammateSource(io).collect('/claude', lead, processes, 6000)).toEqual([])
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
  const [teammate] = await source.collect('/claude', lead, processes, 10000)
  // Its own transcript first, then those of the agents it spawned itself.
  expect(teammate.transcripts).toEqual([
    `${folder}/mine.jsonl`,
    `${folder}/mine/subagents/agent-abc.jsonl`
  ])
  expect(teammate.ref.activity).toBe('running')
  expect(JSON.stringify(teammate)).not.toContain('CANARY')

  // Once tied, the folder is not searched again.
  const list = vi.spyOn(io, 'list')
  files[`${folder}/mine.jsonl`] = transcript('lena-b0')
  expect((await source.collect('/claude', lead, processes, 12000))[0].ref.activity).toBe('thinking')
  expect((await source.collect('/claude', lead, processes, 70000))[0].ref.activity).toBe('idle')
  expect(searches(list)).toBe(0)
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
    const [teammate] = await source.collect('/claude', lead, processes, now)
    expect(teammate).toMatchObject({ transcripts: [], ref: { activity: 'thinking' } })
  }
  expect(searches(list)).toBe(1)
  files[`${folder}/mine.jsonl`] = transcript('lena-b0')
  const [teammate] = await source.collect('/claude', lead, processes, 16000)
  expect(teammate.transcripts).toEqual([`${folder}/mine.jsonl`])
  expect(searches(list)).toBe(2)
})

it('forgets teammates that left, so a restarted one is searched for afresh', async () => {
  const io = fixtureIo({
    [roster]: config([member('lena-b0', { joinedAt: 500 })]),
    [`${folder}/mine.jsonl`]: transcript('lena-b0')
  })
  const source = new TeammateSource(io)
  const [tied] = await source.collect('/claude', lead, async () => [alive('lena-b0', 93143)], 6000)
  expect(tied.transcripts).toEqual([`${folder}/mine.jsonl`])
  source.prune()
  await source.collect('/claude', lead, async () => [], 8000)
  source.prune()
  const list = vi.spyOn(io, 'list')
  await source.collect('/claude', lead, async () => [alive('lena-b0', 93143)], 10000)
  expect(searches(list)).toBe(1)
})
