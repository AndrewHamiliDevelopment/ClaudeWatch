import { afterEach, expect, it, vi } from 'vitest'
import { BridgePoller } from './poller'
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
  expect(messages[1]).toEqual({ type: 'patch', v: 1, seq: 1, upserts: [], removed: ['claude:a'] })
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
    if (args[0] === '-Ao' && discoveryCalls++ > 0)
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
    if (args[0] === '-o') return live ? entry.procStart : ''
    if (args[0] === '-E') {
      environmentReads++
      return 'claude ORCA_PANE_KEY=p'
    }
    return ''
  }
  const poller = new BridgePoller({ io, claudeRoots: ['/claude'], codexRoot: '/codex' })
  await poller.tick()
  live = false
  await poller.tick()
  live = true
  await poller.tick()
  expect(environmentReads).toBe(2)
})
