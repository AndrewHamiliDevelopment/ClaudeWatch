import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { EventEmitter } from 'events'
import { BridgeHost, type BridgeProcess } from './bridge-host'
import type { FeedMessage, OfficeSnapshot } from '../shared/office/types'

class FakeProcess extends EventEmitter implements BridgeProcess {
  kill = vi.fn(() => true)
}

const hello = (rev: number): FeedMessage => {
  const snapshot: OfficeSnapshot = { rev, generatedAtMs: 1, sessions: [], sources: [] }
  return { type: 'hello', v: 1, snapshot }
}

describe('BridgeHost', () => {
  let spawned: FakeProcess[]
  let host: BridgeHost

  beforeEach(() => {
    vi.useFakeTimers()
    spawned = []
    host = new BridgeHost({
      spawn: () => {
        const child = new FakeProcess()
        spawned.push(child)
        return child
      }
    })
  })

  afterEach(() => {
    host.stop()
    vi.useRealTimers()
  })

  it('spawns one bridge and folds its hello into the snapshot', () => {
    const listener = vi.fn()
    host.onMessage(listener)
    host.start()
    host.start()
    spawned[0].emit('message', hello(3))

    expect(spawned).toHaveLength(1)
    expect(host.snapshot()?.rev).toBe(3)
    expect(listener).toHaveBeenCalledWith(hello(3))
  })

  it('ignores messages that are not feed messages', () => {
    const listener = vi.fn()
    host.onMessage(listener)
    host.start()
    spawned[0].emit('message', { type: 'hello', v: 2 })
    spawned[0].emit('message', 'junk')

    expect(listener).not.toHaveBeenCalled()
    expect(host.snapshot()).toBeNull()
  })

  it('restarts the bridge after an unexpected exit, with backoff', () => {
    host.start()
    spawned[0].emit('exit', 1)
    expect(spawned).toHaveLength(1)

    vi.advanceTimersByTime(1_000)
    expect(spawned).toHaveLength(2)

    spawned[1].emit('exit', 1)
    vi.advanceTimersByTime(1_000)
    expect(spawned).toHaveLength(2)
    vi.advanceTimersByTime(1_000)
    expect(spawned).toHaveLength(3)
  })

  it('kills the bridge on stop and does not restart it', () => {
    host.start()
    host.stop()
    spawned[0].emit('exit', 0)
    vi.advanceTimersByTime(60_000)

    expect(spawned[0].kill).toHaveBeenCalledOnce()
    expect(spawned).toHaveLength(1)
    expect(host.snapshot()).toBeNull()
  })
})
