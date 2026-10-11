import { afterEach, expect, it, vi } from 'vitest'
import { BridgePoller } from './poller'
import * as processTable from './process-table'
import { fixtureIo, registryEntry } from './__fixtures__/helpers'
import type { FeedMessage } from '../shared/office/types'

afterEach(() => vi.useRealTimers())
it('posts hello followed by removal patches and stops scheduling', async () => {
  vi.useFakeTimers()
  const entry = registryEntry()
  const files = { '/claude/sessions/42.json': JSON.stringify(entry), '/repo/.git': null }
  const io = fixtureIo(files)
  let live = true
  io.exec = async (file, args) =>
    file.endsWith('ps') && args[0] === '-o' ? (live ? entry.procStart : '') : ''
  const messages: FeedMessage[] = []
  const poller = new BridgePoller({
    io,
    claudeRoots: ['/claude'],
    codexRoot: '/codex',
    now: () => Date.now()
  })
  const stop = await poller.start((message) => messages.push(message))
  expect(messages[0]).toMatchObject({
    type: 'hello',
    snapshot: { sessions: [{ key: 'claude:a' }] }
  })
  live = false
  await vi.advanceTimersByTimeAsync(2000)
  // seq continues from the hello's revision, so one counter orders the whole feed.
  expect(messages[0]).toMatchObject({ snapshot: { rev: 1 } })
  expect(messages[1]).toMatchObject({
    type: 'patch',
    v: 1,
    seq: 2,
    upserts: [],
    removed: ['claude:a']
  })
  stop()
  await vi.advanceTimersByTimeAsync(6000)
  expect(messages).toHaveLength(2)
})
it('deduplicates extra roots and produces healthy empty snapshots', async () => {
  const poller = new BridgePoller({
    io: fixtureIo(),
    claudeRoots: ['/missing', '/missing'],
    codexRoot: '/codex',
    now: () => 1000
  })
  const snapshot = await poller.tick()
  expect(snapshot.sessions).toEqual([])
  expect(snapshot.sources.filter((source) => source.id.startsWith('claude:'))).toEqual([
    { id: 'claude:/missing', ok: true, detail: 'empty' }
  ])
})
it('keeps two-second cadence when collection takes time', async () => {
  vi.useFakeTimers()
  const io = fixtureIo()
  let discoveryCalls = 0
  io.exec = async (_file, args) => {
    if (args[0] === '-xo' && discoveryCalls++ > 0)
      await new Promise((resolve) => setTimeout(resolve, 500))
    return ''
  }
  const post = vi.fn()
  const poller = new BridgePoller({
    io,
    claudeRoots: [],
    codexRoot: '/codex',
    now: () => Date.now()
  })
  const stop = await poller.start(post)
  await vi.advanceTimersByTimeAsync(4500)
  expect(post).toHaveBeenCalledTimes(3)
  stop()
})

it('prunes environment identities when their sessions disappear', async () => {
  const entry = registryEntry()
  const io = fixtureIo({ '/claude/sessions/42.json': JSON.stringify(entry), '/repo/.git': null })
  let live = true
  let environmentReads = 0
  io.exec = async (_file, args) => {
    if (args.includes('lstart=')) return live ? entry.procStart : ''
    if (args[0] === '-E') {
      environmentReads++
      return 'claude ORCA_PANE_KEY=p'
    }
    return args.includes('command=') ? 'claude' : ''
  }
  const poller = new BridgePoller({ io, claudeRoots: ['/claude'], codexRoot: '/codex' })
  await poller.tick()
  live = false
  await poller.tick()
  live = true
  await poller.tick()
  expect(environmentReads).toBe(2)
})

const transcript = '/claude/projects/-repo/a.jsonl'
const usageLine = (id: string, output: number): string =>
  `${JSON.stringify({
    type: 'assistant',
    message: {
      id,
      content: [{ type: 'text', text: 'CANARY_PROMPT' }],
      usage: {
        input_tokens: 1,
        output_tokens: output,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0
      }
    }
  })}\n`

it('sends hello before counting any tokens, then fills usage in with the next patch', async () => {
  vi.useFakeTimers()
  const entry = registryEntry()
  const io = fixtureIo({
    '/claude/sessions/42.json': JSON.stringify(entry),
    '/repo/.git': null,
    [transcript]: usageLine('m1', 5) + usageLine('m1', 9)
  })
  io.exec = async (_file, args) => (args[0] === '-o' ? entry.procStart : '')
  const read = vi.spyOn(io, 'readFrom')
  const messages: FeedMessage[] = []
  const poller = new BridgePoller({
    io,
    claudeRoots: ['/claude'],
    codexRoot: '/codex',
    now: () => Date.now()
  })
  const stop = await poller.start((message) => messages.push(message))
  expect(messages[0]).toMatchObject({
    type: 'hello',
    snapshot: { sessions: [{ key: 'claude:a', usage: null }] }
  })
  expect(read).not.toHaveBeenCalled()
  expect(poller.isCountingUsage).toBe(true)
  await vi.advanceTimersByTimeAsync(2000)
  expect(messages[1]).toMatchObject({
    type: 'patch',
    upserts: [
      {
        key: 'claude:a',
        usage: {
          own: { input: 1, output: 9, cacheWrite: 0, cacheRead: 0 },
          spawned: 0,
          contextTokens: 1,
          contextLimit: null
        }
      }
    ]
  })
  expect(poller.isCountingUsage).toBe(false)
  // Numbers and labels cross the feed; transcript text never does.
  expect(JSON.stringify(messages)).not.toContain('CANARY')
  stop()
})

it('re-sends a session for its token counters at most every ten seconds', async () => {
  vi.useFakeTimers()
  const entry = registryEntry()
  const files: Record<string, string | null> = {
    '/claude/sessions/42.json': JSON.stringify(entry),
    '/repo/.git': null,
    [transcript]: usageLine('m0', 1)
  }
  const io = fixtureIo(files)
  io.exec = async (_file, args) => (args[0] === '-o' ? entry.procStart : '')
  const messages: FeedMessage[] = []
  const poller = new BridgePoller({
    io,
    claudeRoots: ['/claude'],
    codexRoot: '/codex',
    now: () => Date.now()
  })
  const stop = await poller.start((message) => messages.push(message))
  await vi.advanceTimersByTimeAsync(2000)
  const outputs: (number | undefined)[] = []
  for (let turn = 1; turn <= 5; turn++) {
    files[transcript] += usageLine(`m${turn}`, 10)
    await vi.advanceTimersByTimeAsync(2000)
    const patch = messages.at(-1)
    outputs.push(patch?.type === 'patch' ? patch.upserts[0]?.usage?.own.output : undefined)
  }
  expect(outputs).toEqual([undefined, undefined, undefined, undefined, 51])
  stop()
})

it('shows a teammate under its lead with its own pane, then its tokens', async () => {
  const lead = '6a654bca-1111-2222-3333-444444444444'
  const team = 'session-6a654bca'
  const entry = { ...registryEntry(), sessionId: lead }
  const io = fixtureIo({
    '/claude/sessions/42.json': JSON.stringify(entry),
    '/repo/.git': null,
    [`/claude/projects/-repo/${lead}.jsonl`]: usageLine('m1', 2),
    '/claude/projects/-repo/mate.jsonl':
      `${JSON.stringify({ type: 'attachment', teamName: team, agentName: 'lena-b0' })}\n` +
      usageLine('t1', 30),
    [`/claude/teams/${team}/config.json`]: JSON.stringify({
      leadSessionId: lead,
      members: [{ agentId: `lena-b0@${team}`, name: 'lena-b0', agentType: 'lena', cwd: '/repo' }]
    })
  })
  let isMateAlive = true
  io.exec = async (_file, args) => {
    if (args.includes('lstart=')) return entry.procStart
    if (args[0] === '-E') return `claude ORCA_PANE_KEY=pane-${args.at(-1)}`
    if (args.includes('command=')) return 'claude'
    return isMateAlive
      ? `93143 ${entry.procStart} /versions/2.1.296 --agent-id lena-b0@${team} --parent-session-id ${lead}`
      : ''
  }
  const poller = new BridgePoller({
    io,
    claudeRoots: ['/claude'],
    codexRoot: '/codex',
    now: () => 2000
  })
  const first = (await poller.tick()).sessions[0]
  expect(first).toMatchObject({ orcaPaneKey: 'pane-42', usage: null })
  expect(first.subagents).toEqual([
    {
      id: `lena-b0@${team}`,
      type: 'lena',
      activity: 'thinking',
      kind: 'teammate',
      name: 'lena-b0',
      cwd: '/repo',
      pid: 93143,
      startedAtMs: Date.parse(`${entry.procStart} UTC`),
      orcaPaneKey: 'pane-93143',
      tokens: null
    }
  ])
  const second = (await poller.tick()).sessions[0]
  expect(second.subagents[0].tokens).toEqual({ input: 1, output: 30, cacheWrite: 0, cacheRead: 0 })
  const whileAlive = { own: { output: 2 }, subagents: { input: 1, output: 30 }, spawned: 1 }
  expect(second.usage).toMatchObject(whileAlive)

  // The teammate finishes: it leaves the office, and what it spent stays in its lead's total.
  isMateAlive = false
  const third = (await poller.tick()).sessions[0]
  expect(third.subagents).toEqual([])
  expect(third.usage).toMatchObject(whileAlive)
})

it('parses the process table once per tick, however many sources read it', async () => {
  const lead = '6a654bca-1111-2222-3333-444444444444'
  const team = 'session-6a654bca'
  const entry = { ...registryEntry(), sessionId: lead }
  const io = fixtureIo({
    '/claude/sessions/42.json': JSON.stringify(entry),
    '/repo/.git': null,
    [`/claude/teams/${team}/config.json`]: JSON.stringify({
      leadSessionId: lead,
      members: [{ agentId: `lena-b0@${team}`, name: 'lena-b0', agentType: 'lena', cwd: '/repo' }]
    })
  })
  io.exec = async (_file, args) =>
    args[0] === '-xo'
      ? `42 ${entry.procStart} claude\n93143 ${entry.procStart} claude --agent-id lena-b0@${team} --parent-session-id ${lead}\n`
      : args.includes('lstart=')
        ? entry.procStart
        : 'claude'
  // The reader parses what it reads, so one call is one parse for both sources.
  const parse = vi.spyOn(processTable, 'readProcessTable')
  const poller = new BridgePoller({ io, claudeRoots: ['/claude'], codexRoot: '/codex' })
  expect((await poller.tick()).sessions[0].subagents).toHaveLength(1)
  expect(parse).toHaveBeenCalledTimes(1)
  parse.mockRestore()
})

it('reads one process table per tick for the Claude and Codex sources together', async () => {
  const entry = registryEntry()
  const io = fixtureIo({ '/claude/sessions/42.json': JSON.stringify(entry), '/repo/.git': null })
  const exec = vi.fn(async (_file: string, args: string[]) =>
    args.includes('lstart=') ? entry.procStart : ''
  )
  io.exec = exec
  const poller = new BridgePoller({ io, claudeRoots: ['/claude'], codexRoot: '/codex' })
  await poller.tick()
  await poller.tick()
  expect(exec.mock.calls.filter(([, args]) => args[0] === '-xo')).toHaveLength(2)
})

it('carries on after a tick that fails, with no unhandled rejection', async () => {
  vi.useFakeTimers()
  const unhandled = vi.fn()
  process.on('unhandledRejection', unhandled)
  const error = vi.spyOn(process.stderr, 'write').mockReturnValue(true)
  try {
    let ticks = 0
    const poller = new BridgePoller({
      io: fixtureIo(),
      claudeRoots: [],
      codexRoot: '/codex',
      now: () => {
        if (++ticks === 2) throw new Error('SECRET_PATH /Users/owner')
        return Date.now()
      }
    })
    const post = vi.fn()
    const stop = await poller.start(post)
    await vi.advanceTimersByTimeAsync(2000)
    await vi.advanceTimersByTimeAsync(2000)
    stop()
    await vi.advanceTimersByTimeAsync(0)

    expect(unhandled).not.toHaveBeenCalled()
    // The hello, then the tick after the failed one.
    expect(post).toHaveBeenCalledTimes(2)
    expect(error.mock.calls).toEqual([['Office bridge tick failed\n']])
  } finally {
    process.off('unhandledRejection', unhandled)
    error.mockRestore()
  }
})

it('polls at the pace it is told, and at once when told to speed up', async () => {
  vi.useFakeTimers()
  const poller = new BridgePoller({ io: fixtureIo(), claudeRoots: [], codexRoot: '/codex' })
  const post = vi.fn()
  const stop = await poller.start(post)
  expect(post).toHaveBeenCalledTimes(1)

  poller.setIntervalMs(30_000)
  await vi.advanceTimersByTimeAsync(29_999)
  expect(post).toHaveBeenCalledTimes(1)
  await vi.advanceTimersByTimeAsync(1)
  expect(post).toHaveBeenCalledTimes(2)

  // A window came back: it should not wait out the slow interval to see current state.
  poller.setIntervalMs(2000)
  await vi.advanceTimersByTimeAsync(0)
  expect(post).toHaveBeenCalledTimes(3)
  await vi.advanceTimersByTimeAsync(2000)
  expect(post).toHaveBeenCalledTimes(4)
  stop()
})

it('keeps the pace it was given before it started', async () => {
  vi.useFakeTimers()
  const poller = new BridgePoller({ io: fixtureIo(), claudeRoots: [], codexRoot: '/codex' })
  poller.setIntervalMs(30_000)
  const post = vi.fn()
  const stop = await poller.start(post)
  await vi.advanceTimersByTimeAsync(29_999)
  expect(post).toHaveBeenCalledTimes(1)
  stop()
})
