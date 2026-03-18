import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePromoStatus } from '../hooks/usePromoStatus'
import type { PromoStatus } from '../lib/types'

describe('usePromoStatus', () => {
  let promoCallback: ((data: PromoStatus) => void) | null = null

  const mockPromo: PromoStatus = {
    is2x: true,
    promoActive: true,
    isWeekend: false,
    currentWindowEnd: '2:00 PM',
    nextWindowStart: null,
    expiresInSeconds: 3600,
    promoPeriod: 'March 13–27, 2026',
    peakHoursLocal: '8:00 AM – 2:00 PM'
  }

  beforeEach(() => {
    vi.useFakeTimers()
    promoCallback = null
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
      getUsage: vi.fn().mockResolvedValue(null),
      refreshUsage: vi.fn().mockResolvedValue(null),
      onUsageUpdate: vi.fn().mockReturnValue(() => {}),
      getPromoStatus: vi.fn().mockResolvedValue(mockPromo),
      onPromoUpdate: vi.fn().mockImplementation((cb) => {
        promoCallback = cb
        return () => {
          promoCallback = null
        }
      })
    }
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    // @ts-expect-error -- cleanup
    delete window.api
  })

  it('starts with null promo', () => {
    const { result } = renderHook(() => usePromoStatus())
    expect(result.current.promo).toBeNull()
  })

  it('fetches initial promo status', async () => {
    const { result } = renderHook(() => usePromoStatus())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(window.api.getPromoStatus).toHaveBeenCalledOnce()
    expect(result.current.promo).toEqual(mockPromo)
  })

  it('subscribes to promo updates', async () => {
    const { result } = renderHook(() => usePromoStatus())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    const updatedPromo: PromoStatus = { ...mockPromo, is2x: false, expiresInSeconds: null }
    act(() => {
      promoCallback?.(updatedPromo)
    })

    expect(result.current.promo?.is2x).toBe(false)
  })

  it('counts down expiresInSeconds locally', async () => {
    const { result } = renderHook(() => usePromoStatus())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(result.current.promo?.expiresInSeconds).toBe(3600)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.promo?.expiresInSeconds).toBe(3599)
  })

  it('cleans up subscription on unmount', async () => {
    const { unmount } = renderHook(() => usePromoStatus())

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0)
    })

    expect(promoCallback).toBeTruthy()
    unmount()
    expect(promoCallback).toBeNull()
  })

  it('handles missing window.api gracefully', () => {
    // @ts-expect-error -- cleanup
    delete window.api

    const { result } = renderHook(() => usePromoStatus())
    expect(result.current.promo).toBeNull()
  })
})
