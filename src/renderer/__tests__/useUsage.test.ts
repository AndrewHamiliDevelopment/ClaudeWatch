import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUsage } from '../hooks/useUsage'
import type { UsageStats } from '../lib/types'

describe('useUsage', () => {
  let usageCallback: ((data: UsageStats) => void) | null = null

  const mockUsage: UsageStats = {
    totalInputTokens: 1500,
    totalOutputTokens: 2800,
    totalCacheReadTokens: 6000,
    totalCacheCreationTokens: 4000,
    totalCostUSD: 4.0,
    modelUsage: [
      {
        model: 'claude-opus-4-6',
        inputTokens: 300,
        outputTokens: 500,
        cacheReadInputTokens: 1500,
        cacheCreationInputTokens: 750,
        costUSD: 3.5
      }
    ],
    dataAvailable: true,
    lastUpdated: '2026-03-18T10:00:00Z'
  }

  beforeEach(() => {
    usageCallback = null
    window.api = {
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
      getUsage: vi.fn().mockResolvedValue(mockUsage),
      refreshUsage: vi.fn().mockResolvedValue({ ...mockUsage, totalCostUSD: 5.0 }),
      onUsageUpdate: vi.fn().mockImplementation((cb) => {
        usageCallback = cb
        return () => {
          usageCallback = null
        }
      }),
      getPromoStatus: vi.fn().mockResolvedValue(null),
      onPromoUpdate: vi.fn().mockReturnValue(() => {})
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error -- cleanup
    delete window.api
  })

  it('starts with loading=true', () => {
    const { result } = renderHook(() => useUsage())
    expect(result.current.loading).toBe(true)
    expect(result.current.usage).toBeNull()
  })

  it('fetches initial usage data', async () => {
    const { result } = renderHook(() => useUsage())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(window.api.getUsage).toHaveBeenCalledOnce()
    expect(result.current.usage).toEqual(mockUsage)
    expect(result.current.loading).toBe(false)
  })

  it('subscribes to usage updates', async () => {
    const { result } = renderHook(() => useUsage())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    const updated = { ...mockUsage, totalCostUSD: 10.0 }
    act(() => {
      usageCallback?.(updated)
    })

    expect(result.current.usage?.totalCostUSD).toBe(10.0)
  })

  it('refresh calls refreshUsage', async () => {
    const { result } = renderHook(() => useUsage())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    await act(async () => {
      result.current.refresh()
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(window.api.refreshUsage).toHaveBeenCalledOnce()
    expect(result.current.usage?.totalCostUSD).toBe(5.0)
  })

  it('toggles showModelBreakdown', async () => {
    const { result } = renderHook(() => useUsage())

    expect(result.current.showModelBreakdown).toBe(false)

    act(() => {
      result.current.setShowModelBreakdown(true)
    })

    expect(result.current.showModelBreakdown).toBe(true)
  })

  it('cleans up subscription on unmount', async () => {
    const { unmount } = renderHook(() => useUsage())

    await act(async () => {
      await new Promise((r) => setTimeout(r, 0))
    })

    expect(usageCallback).toBeTruthy()
    unmount()
    expect(usageCallback).toBeNull()
  })

  it('handles missing window.api gracefully', () => {
    // @ts-expect-error -- cleanup
    delete window.api

    const { result } = renderHook(() => useUsage())
    expect(result.current.loading).toBe(false)
    expect(result.current.usage).toBeNull()

    // refresh should not throw
    act(() => {
      result.current.refresh()
    })
  })
})
