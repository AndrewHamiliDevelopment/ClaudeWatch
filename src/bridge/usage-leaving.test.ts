import { expect, it, vi } from 'vitest'
import { type SessionFiles, type TranscriptDelta, UsageTracker } from './usage-tracker'
import { fixtureIo } from './__fixtures__/helpers'

const line = (id: string, output: number): string =>
  `${JSON.stringify({
    type: 'assistant',
    timestamp: '2026-10-11T10:00:00.000Z',
    message: { id, content: [], usage: { input_tokens: 0, output_tokens: output } }
  })}\n`
const bytes = (text: string): number => Buffer.byteLength(text)
const main = '/p/s.jsonl'
const agent = '/p/s/subagents/agent-abc.jsonl'
const mate = '/p/mate.jsonl'

// One session with a main transcript, an agent and a teammate, scanned for whoever counts lines.
function leavingSession(limits: { budgetBytes?: number } = {}) {
  const files: Record<string, string> = {
    [main]: line('m1', 5),
    [agent]: line('a1', 7),
    [mate]: line('t1', 3)
  }
  const io = fixtureIo(files)
  const tracker = new UsageTracker(io, limits)
  const added: TranscriptDelta[] = []
  const live = (teammates: [string, string[]][]): Map<string, SessionFiles> =>
    new Map([
      [
        'claude:s',
        {
          main,
          agents: [{ id: 'abc', path: agent, size: bytes(files[agent]), mtimeMs: 1 }],
          teammates: new Map(teammates)
        }
      ]
    ])
  const scan = (teammates: [string, string[]][] | 'gone'): Promise<void> =>
    tracker.scan(teammates === 'gone' ? new Map() : live(teammates), (delta) => added.push(delta))
  // Scans the live session until it is counted, and forgets what that reported.
  const count = async (teammates: [string, string[]][] = []): Promise<void> => {
    do await scan(teammates)
    while (tracker.isBehind)
    added.length = 0
  }
  return { files, io, tracker, added, scan, count }
}
// What was reported, as [session, transcript, output tokens].
const reported = (added: TranscriptDelta[]): [string, string, number][] =>
  added.map(({ sessionKey, file, counts }) => [sessionKey, file, counts.output])

it('reads every transcript of a session that left once more, then lets go of it', async () => {
  const { files, io, tracker, added, scan, count } = leavingSession()
  await count([['lena@session-s', [mate]]])

  // Written after the last scan that saw the session: by it, by an agent and by a teammate.
  files[main] += line('m2', 20)
  files[agent] += line('a2', 30)
  files[mate] += line('t2', 40)
  await scan('gone')
  expect(reported(added)).toEqual([
    ['claude:s', main, 20],
    ['claude:s', agent, 30],
    ['claude:s', mate, 40]
  ])
  expect(tracker.isLeaving('claude:s')).toBe(false)

  added.length = 0
  const read = vi.spyOn(io, 'readFrom')
  await scan('gone')
  expect(added).toEqual([])
  expect(read).not.toHaveBeenCalled()
  expect(tracker.tokens([main, agent, mate])).toBeNull()
})

it('reads a teammate that finished earlier once more when its lead leaves too', async () => {
  const { files, added, scan, count } = leavingSession()
  await count([['lena@session-s', [mate]]])
  // The teammate's process exits first, so the roster no longer lists it.
  await count()
  files[mate] += line('t2', 40)
  await scan('gone')
  expect(reported(added)).toEqual([['claude:s', mate, 40]])
})

it('keeps a session that left until its transcripts are read to their end, a budget at a time', async () => {
  const { files, tracker, added, scan, count } = leavingSession({
    budgetBytes: bytes(line('m2', 20))
  })
  await count()

  files[main] += line('m2', 20) + line('m3', 21) + line('m4', 22)
  await scan('gone')
  expect(reported(added)).toEqual([['claude:s', main, 20]])
  expect(tracker.isLeaving('claude:s')).toBe(true)
  await scan('gone')
  await scan('gone')
  expect(reported(added).map(([, , output]) => output)).toEqual([20, 21, 22])
  expect(tracker.isLeaving('claude:s')).toBe(false)
})

it('skips a transcript that is gone by the time its session leaves', async () => {
  const { files, tracker, added, scan, count } = leavingSession()
  await count()
  delete files[main]
  files[agent] += line('a2', 30)
  await scan('gone')
  expect(reported(added)).toEqual([['claude:s', agent, 30]])
  expect(tracker.isLeaving('claude:s')).toBe(false)
  expect(tracker.health()).toEqual({ id: 'usage', ok: true, detail: 'counted' })
})

it('goes on from where it was when a session that left comes back before it is let go', async () => {
  const { files, tracker, added, scan, count } = leavingSession({
    budgetBytes: bytes(line('m2', 20))
  })
  await count()
  files[main] += line('m2', 20) + line('m3', 21)
  await scan('gone')
  do await scan([])
  while (tracker.isBehind)
  expect(reported(added).map(([, , output]) => output)).toEqual([20, 21])
  expect(tracker.isLeaving('claude:s')).toBe(false)
})

it('reads nothing more of a session that left while nobody counts lines', async () => {
  const { files, io, tracker } = leavingSession()
  await tracker.scan(new Map([['claude:s', { main, agents: [], teammates: new Map() }]]))
  files[main] += line('m2', 20)
  const read = vi.spyOn(io, 'readFrom')
  await tracker.scan(new Map())
  expect(read).not.toHaveBeenCalled()
  expect(tracker.tokens([main])).toBeNull()
})

it('notes the transcripts of a scan given no bytes, so a session that leaves before the next is still read', async () => {
  const { io, tracker, added, scan } = leavingSession()
  const read = vi.spyOn(io, 'readFrom')
  await tracker.scan(
    new Map([['claude:s', { main, agents: [], teammates: new Map([['lena@session-s', [mate]]]) }]]),
    (delta) => added.push(delta),
    0
  )
  expect(read).not.toHaveBeenCalled()
  expect(tracker.isBehind).toBe(true)
  expect(tracker.usage('claude:s')).toBeNull()
  await scan('gone')
  expect(reported(added)).toEqual([
    ['claude:s', main, 5],
    ['claude:s', mate, 3]
  ])
})
