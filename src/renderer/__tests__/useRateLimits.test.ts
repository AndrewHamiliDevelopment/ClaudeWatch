import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useRateLimits } from '../hooks/useRateLimits'
import type { RateLimits } from '../lib/types'
import { mockApi } from './api-mock'

describe('useRateLimits', () => {
  let rateLimitsCallback: ((data: RateLimits) => void) | null = null

  const mockRateLimits: RateLimits = {
    window_5h: { used_percentage: 45, resets_at: '2026-03-20T20:00:00Z' },
    window_7d: { used_percentage: 62, resets_at: '2026-03-27T00:00:00Z' },
    updated_at: '2026-03-20T15:00:00Z',
    dataAvailable: true,
    isStale: false,
    isVeryStale: false
  }

  beforeEach(() => {
    rateLimitsCallback = null
    window.api = mockApi({
      getInstances: vi.fn(),
      getSettings: vi.fn(),
      setSettings: vi.fn(),
      getHistory: vi.fn(),
      clearHistory: vi.fn(),
      openDashboard: vi.fn(),
      quit: vi.fn(),
      openTerminal: vi.fn(),
      onInstancesUpdate: vi.fn().mockReturnValue(() => {}),
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      installUpdate: vi.fn(),
      onUpdaterStatus: vi.fn().mockReturnValue(() => {}),
      getUsage: vi.fn().mockResolvedValue(null),
      refreshUsage: vi.fn().mockResolvedValue(null),
      onUsageUpdate: vi.fn().mockReturnValue(() => {}),
      getPromoStatus: vi.fn().mockResolvedValue(null),
      onPromoUpdate: vi.fn().mockReturnValue(() => {}),
      getRateLimits: vi.fn().mockResolvedValue(mockRateLimits),
      onRateLimitsUpdate: vi.fn().mockImplementation((cb) => {
        rateLimitsCallback = cb
        return () => {
          rateLimitsCallback = null
        }
      }),
      checkNotificationPermission: vi.fn(),
      openNotificationSettings: vi.fn(),
      sendTestNotification: vi.fn(),
      muteProject: vi.fn(),
      unmuteProject: vi.fn()
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error -- cleanup
    delete window.api
  })

  it('starts with loading=true and null rateLimits', () => {
    const { result, unmount } = renderHook(() => useRateLimits())
    expect(result.current.loading).toBe(true)
    expect(result.current.rateLimits).toBeNull()
    // Leaves before the pending read resolves into a finished test.
    unmount()
  })

  it('fetches initial rate limits data', async () => {
    const { result } = renderHook(() => useRateLimits())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(window.api.getRateLimits).toHaveBeenCalledOnce()
    expect(result.current.rateLimits).toEqual(mockRateLimits)
    expect(result.current.loading).toBe(false)
  })

  it('subscribes to rate limits updates', async () => {
    const { result } = renderHook(() => useRateLimits())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const updated: RateLimits = {
      ...mockRateLimits,
      window_5h: { used_percentage: 80, resets_at: '2026-03-20T20:00:00Z' }
    }
    act(() => {
      rateLimitsCallback?.(updated)
    })

    expect(result.current.rateLimits?.window_5h.used_percentage).toBe(80)
  })

  it('cleans up subscription on unmount', async () => {
    const { unmount } = renderHook(() => useRateLimits())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(rateLimitsCallback).toBeTruthy()
    unmount()
    expect(rateLimitsCallback).toBeNull()
  })

  it('handles missing window.api gracefully', () => {
    // @ts-expect-error -- cleanup
    delete window.api

    const { result } = renderHook(() => useRateLimits())
    expect(result.current.loading).toBe(false)
    expect(result.current.rateLimits).toBeNull()
  })
})
