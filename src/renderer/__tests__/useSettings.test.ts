import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSettings } from '../hooks/useSettings'
import type { AppSettings } from '../lib/types'
import { DEFAULT_SETTINGS } from '../lib/types'
import { mockApi } from './api-mock'

const mockSettings: AppSettings = {
  ...DEFAULT_SETTINGS,
  pollingIntervalMs: 5000,
  cpuIdleThreshold: 2.0
}

describe('useSettings', () => {
  beforeEach(() => {
    window.api = mockApi({
      getInstances: vi.fn(),
      getSettings: vi.fn().mockResolvedValue(mockSettings),
      setSettings: vi.fn().mockImplementation(async (partial) => ({
        ...mockSettings,
        ...partial
      })),
      getHistory: vi.fn(),
      clearHistory: vi.fn(),
      openDashboard: vi.fn(),
      quit: vi.fn(),
      onInstancesUpdate: vi.fn().mockReturnValue(() => {})
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error -- cleanup
    delete window.api
  })

  it('loads settings on mount', async () => {
    const { result } = renderHook(() => useSettings())

    expect(result.current.loading).toBe(true)

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    expect(result.current.settings.pollingIntervalMs).toBe(5000)
    expect(window.api.getSettings).toHaveBeenCalledOnce()
  })

  it('uses DEFAULT_SETTINGS before loading completes', () => {
    const { result } = renderHook(() => useSettings())

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
  })

  it('updates settings via updateSettings', async () => {
    const { result } = renderHook(() => useSettings())

    await waitFor(() => {
      expect(result.current.loading).toBe(false)
    })

    await act(async () => {
      await result.current.updateSettings({ pollingIntervalMs: 1000 })
    })

    expect(window.api.setSettings).toHaveBeenCalledWith({
      pollingIntervalMs: 1000
    })
    expect(result.current.settings.pollingIntervalMs).toBe(1000)
  })

  it('handles missing window.api gracefully', async () => {
    // @ts-expect-error -- cleanup
    delete window.api

    const { result } = renderHook(() => useSettings())

    expect(result.current.settings).toEqual(DEFAULT_SETTINGS)
    expect(result.current.loading).toBe(false)
  })
})
