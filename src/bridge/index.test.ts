import { afterEach, expect, it, vi } from 'vitest'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { emptySnapshot } from './reducer'

const mocks = vi.hoisted(() => ({ tick: vi.fn(), start: vi.fn(), options: vi.fn() }))
vi.mock('./poller', () => ({
  BridgePoller: class {
    constructor(options: unknown) {
      mocks.options(options)
    }
    tick = mocks.tick
    start = mocks.start
  }
}))
import { main } from './index'

afterEach(() => {
  vi.restoreAllMocks()
  vi.clearAllMocks()
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
