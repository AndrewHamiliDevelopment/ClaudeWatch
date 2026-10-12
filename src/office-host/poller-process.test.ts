import { describe, it, expect, vi } from 'vitest'
import { BridgeHost } from '../main/bridge-host'
import type { FeedMessage, OfficeSnapshot } from '../shared/office/types'
import { PollerProcess } from './poller-process'

const hello = (rev: number): FeedMessage => {
  const snapshot: OfficeSnapshot = { rev, generatedAtMs: 1, sessions: [], sources: [] }
  return { type: 'hello', v: 1, snapshot }
}

// A poller whose start() the test resolves by hand, like the real one after its first tick.
function fakePoller(): {
  start: (post: (message: FeedMessage) => void) => Promise<() => void>
  post: (message: FeedMessage) => void
  begin: () => void
  fail: () => void
  stop: ReturnType<typeof vi.fn>
} {
  let post: (message: FeedMessage) => void = () => undefined
  let begin: () => void = () => undefined
  let fail: () => void = () => undefined
  const stop = vi.fn()
  return {
    start: (deliver) => {
      post = deliver
      return new Promise((resolve, reject) => {
        begin = () => resolve(stop)
        fail = () => reject(new Error('first poll failed'))
      })
    },
    post: (message) => post(message),
    begin: () => begin(),
    fail: () => fail(),
    stop
  }
}

const settled = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe('PollerProcess', () => {
  it('delivers what the poller posts as process messages', () => {
    const poller = fakePoller()
    const messages = vi.fn()
    new PollerProcess(poller).on('message', messages)

    poller.post(hello(1))

    expect(messages).toHaveBeenCalledExactlyOnceWith(hello(1))
  })

  it('stops the poller when killed, and delivers nothing afterwards', async () => {
    const poller = fakePoller()
    const messages = vi.fn()
    const process = new PollerProcess(poller)
    process.on('message', messages)
    poller.begin()
    await settled()

    expect(process.kill()).toBe(true)
    poller.post(hello(2))

    expect(poller.stop).toHaveBeenCalledOnce()
    expect(messages).not.toHaveBeenCalled()
  })

  it('stops a poller that finishes starting only after the kill', async () => {
    const poller = fakePoller()
    const process = new PollerProcess(poller)

    process.kill()
    poller.begin()
    await settled()

    expect(poller.stop).toHaveBeenCalledOnce()
  })

  it('exits when the poller cannot start, so the host restarts it', async () => {
    const poller = fakePoller()
    const exits = vi.fn()
    new PollerProcess(poller).on('exit', exits)

    poller.fail()
    await settled()

    expect(exits).toHaveBeenCalledExactlyOnceWith(1)
  })

  it('reports no exit for a poller that fails after it was killed', async () => {
    const poller = fakePoller()
    const exits = vi.fn()
    const process = new PollerProcess(poller)
    process.on('exit', exits)

    process.kill()
    poller.fail()
    await settled()

    expect(exits).not.toHaveBeenCalled()
  })

  it('feeds a bridge host the way the utility process does', () => {
    const poller = fakePoller()
    const host = new BridgeHost({ spawn: () => new PollerProcess(poller) })
    host.start()

    poller.post(hello(7))

    expect(host.snapshot()?.rev).toBe(7)
    host.stop()
  })
})
