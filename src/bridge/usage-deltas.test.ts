import { expect, it, vi } from 'vitest'
import { BridgePoller } from './poller'
import { UsageTracker } from './usage-tracker'
import { fixtureIo, registryEntry } from './__fixtures__/helpers'

const minuteMs = (minute: number): number => Date.parse(`2026-10-11T10:${minute}:00.000Z`)
const stamped = (id: string, output: number, minute: number): string =>
  `${JSON.stringify({
    type: 'assistant',
    timestamp: new Date(minuteMs(minute)).toISOString(),
    message: {
      id,
      content: [{ type: 'text', text: 'CANARY_TEXT' }],
      usage: { input_tokens: 0, output_tokens: output }
    }
  })}\n`
const output = (value: number) => ({ input: 0, output: value, cacheWrite: 0, cacheRead: 0 })

it('reports the tokens each transcript added, once, under the session that owns the file', async () => {
  const main = '/p/s.jsonl'
  const agent = '/p/s/subagents/agent-abc.jsonl'
  const mate = '/p/mate.jsonl'
  const files: Record<string, string> = {
    [main]: stamped('m1', 5, 10),
    [agent]: stamped('a1', 7, 11),
    [mate]: stamped('t1', 3, 12)
  }
  const tracker = new UsageTracker(fixtureIo(files))
  const added: unknown[] = []
  const scan = (): Promise<void> =>
    tracker.scan(
      new Map([
        [
          'claude:s',
          {
            main,
            agents: [{ id: 'abc', path: agent, size: Buffer.byteLength(files[agent]), mtimeMs: 1 }],
            teammates: new Map([['lena@session-s', [mate]]])
          }
        ]
      ]),
      (delta) => added.push(delta)
    )
  await scan()
  expect(added).toEqual([
    { sessionKey: 'claude:s', file: main, atMs: minuteMs(10), counts: output(5) },
    { sessionKey: 'claude:s', file: agent, atMs: minuteMs(11), counts: output(7) },
    { sessionKey: 'claude:s', file: mate, atMs: minuteMs(12), counts: output(3) }
  ])
  added.length = 0
  await scan()
  expect(added).toEqual([])
  files[main] += stamped('m1', 9, 13)
  await scan()
  expect(added).toEqual([
    { sessionKey: 'claude:s', file: main, atMs: minuteMs(13), counts: output(4) }
  ])
  expect(JSON.stringify(added)).not.toContain('CANARY')
})

it('reports added tokens with the project of their session, on the tick they arrive', async () => {
  const entry = registryEntry()
  const transcript = '/claude/projects/-repo/a.jsonl'
  const io = fixtureIo({
    '/claude/sessions/42.json': JSON.stringify(entry),
    '/repo/.git': null,
    [transcript]: stamped('m1', 9, 10)
  })
  io.exec = async (_file, args) => (args[0] === '-o' ? entry.procStart : '')
  const onUsage = vi.fn()
  const poller = new BridgePoller({ io, claudeRoots: ['/claude'], codexRoot: '/codex', onUsage })
  // The first tick publishes before counting, so it has nothing to report.
  await poller.tick()
  expect(onUsage).not.toHaveBeenCalled()
  await poller.tick()
  expect(onUsage).toHaveBeenCalledExactlyOnceWith([
    {
      sessionKey: 'claude:a',
      projectKey: expect.stringMatching(/^p_/),
      projectLabel: 'repo',
      file: transcript,
      atMs: minuteMs(10),
      counts: output(9)
    }
  ])
  await poller.tick()
  expect(onUsage).toHaveBeenCalledOnce()
  expect(JSON.stringify(onUsage.mock.calls)).not.toContain('CANARY')
})
