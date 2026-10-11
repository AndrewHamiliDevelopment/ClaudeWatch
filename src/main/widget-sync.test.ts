import { describe, it, expect, vi } from 'vitest'
import { EventEmitter } from 'events'
import { setupWidgetSync } from './widget-sync'
import type { ClaudeInstance, InstanceUpdate } from '../renderer/lib/types'

describe('setupWidgetSync', () => {
  it('rewrites widget data when usage updates arrive', async () => {
    const stats: InstanceUpdate['stats'] = {
      total: 0,
      active: 0,
      idle: 0,
      stale: 0,
      exited: 0,
      recentlyCompleted: 0
    }
    const tracker = Object.assign(new EventEmitter(), {
      getInstances: (): ClaudeInstance[] => [],
      getStats: () => stats
    })

    let usageListener = null as ((data: { dataAvailable: boolean }) => void) | null
    const usageReader = {
      getLastData: vi.fn(() => null),
      onUpdate: vi.fn((listener: (data: { dataAvailable: boolean }) => void) => {
        usageListener = listener
        return () => {
          usageListener = null
        }
      })
    }

    const promoChecker = {
      getLastData: vi.fn(() => null)
    }

    const rateLimitReader = {
      getLastData: vi.fn(() => null),
      onUpdate: vi.fn(() => () => {})
    }

    const writer = {
      write: vi.fn().mockResolvedValue(undefined)
    }

    setupWidgetSync({ tracker, usageReader, promoChecker, rateLimitReader, writer })

    usageListener?.({ dataAvailable: true })
    await Promise.resolve()

    expect(writer.write).toHaveBeenCalledTimes(1)
    expect(writer.write).toHaveBeenCalledWith(
      [],
      tracker.getStats(),
      { dataAvailable: true },
      null,
      null
    )
  })
})
