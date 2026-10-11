import { afterEach, expect, it, vi } from 'vitest'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { emptySnapshot } from './reducer'

const mocks = vi.hoisted(() => ({
  tick: vi.fn(),
  start: vi.fn(),
  options: vi.fn(),
  ticksUntilCounted: 0
}))
vi.mock('./poller', () => ({
  BridgePoller: class {
    constructor(options: unknown) {
      mocks.options(options)
    }
    tick = mocks.tick
    start = mocks.start
    get isCountingUsage(): boolean {
      return mocks.tick.mock.calls.length < mocks.ticksUntilCounted
    }
  }
}))
import { main } from './index'

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetAllMocks()
  mocks.ticksUntilCounted = 0
})
it('prints exactly one JSON snapshot and does not start polling in once mode', async () => {
  const snapshot = emptySnapshot()
  mocks.tick.mockResolvedValue(snapshot)
  const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  await main(['--once', '--root', './extra'])
  expect(write).toHaveBeenCalledWith(`${JSON.stringify(snapshot)}\n`)
  expect(mocks.start).not.toHaveBeenCalled()
  expect(mocks.options).toHaveBeenCalledWith({
    claudeRoots: [join(homedir(), '.claude'), resolve('./extra')]
  })
})
it('keeps ticking in once mode until tokens are counted, and prints only the last snapshot', async () => {
  const snapshots = [1, 2, 3].map((rev) => ({ ...emptySnapshot(), rev }))
  for (const snapshot of snapshots) mocks.tick.mockResolvedValueOnce(snapshot)
  mocks.ticksUntilCounted = 3
  const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  await main(['--once'])
  expect(mocks.tick).toHaveBeenCalledTimes(3)
  expect(write.mock.calls).toEqual([[`${JSON.stringify(snapshots[2])}\n`]])
})
it('gives up waiting in once mode when counting never finishes', async () => {
  mocks.tick.mockResolvedValue(emptySnapshot())
  mocks.ticksUntilCounted = Infinity
  const write = vi.spyOn(process.stdout, 'write').mockReturnValue(true)
  await main(['--once'])
  expect(mocks.tick).toHaveBeenCalledTimes(30)
  expect(write).toHaveBeenCalledTimes(1)
})
it('forwards utility-process feed messages through the parent port', async () => {
  const message = { type: 'hello', v: 1, snapshot: emptySnapshot() }
  mocks.start.mockImplementation(async (post: (value: unknown) => void) => {
    post(message)
    return () => {}
  })
  const postMessage = vi.fn()
  await main([], { postMessage })
  expect(postMessage).toHaveBeenCalledWith(message)
})
it('posts added tokens to the parent as their own message, apart from the feed', async () => {
  mocks.start.mockResolvedValue(() => {})
  const postMessage = vi.fn()
  await main([], { postMessage })
  const deltas = [
    {
      sessionKey: 'claude:a',
      projectKey: 'p_1',
      projectLabel: 'repo',
      file: '/p/a.jsonl',
      atMs: 5,
      counts: { input: 1, output: 2, cacheWrite: 0, cacheRead: 0 }
    }
  ]
  mocks.options.mock.calls[0][0].onUsage(deltas)
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({ type: 'usage', v: 1, deltas })
})
