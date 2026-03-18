import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useUpdater } from '../hooks/useUpdater'
import type { UpdaterStatusPayload } from '../lib/types'

describe('useUpdater', () => {
  let statusCallback: ((payload: UpdaterStatusPayload) => void) | null = null

  beforeEach(() => {
    statusCallback = null
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
      onUpdaterStatus: vi.fn().mockImplementation((cb) => {
        statusCallback = cb
        return () => {
          statusCallback = null
        }
      })
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error -- cleanup
    delete window.api
  })

  it('starts with idle status', () => {
    const { result } = renderHook(() => useUpdater())

    expect(result.current.status).toBe('idle')
    expect(result.current.updateInfo).toBeNull()
    expect(result.current.progress).toBeNull()
    expect(result.current.error).toBeNull()
  })

  it('subscribes to updater status on mount', () => {
    renderHook(() => useUpdater())

    expect(window.api.onUpdaterStatus).toHaveBeenCalledOnce()
    expect(statusCallback).toBeTruthy()
  })

  it('transitions to checking status', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      statusCallback?.({ status: 'checking' })
    })

    expect(result.current.status).toBe('checking')
  })

  it('transitions to available with update info', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      statusCallback?.({
        status: 'available',
        data: { version: '2.0.0', releaseNotes: 'New stuff' }
      })
    })

    expect(result.current.status).toBe('available')
    expect(result.current.updateInfo).toEqual({
      version: '2.0.0',
      releaseNotes: 'New stuff'
    })
    expect(result.current.error).toBeNull()
  })

  it('transitions to downloading with progress', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      statusCallback?.({
        status: 'downloading',
        data: { percent: 50, bytesPerSecond: 1024, transferred: 500, total: 1000 }
      })
    })

    expect(result.current.status).toBe('downloading')
    expect(result.current.progress).toEqual({
      percent: 50,
      bytesPerSecond: 1024,
      transferred: 500,
      total: 1000
    })
  })

  it('transitions to downloaded', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      statusCallback?.({ status: 'downloaded' })
    })

    expect(result.current.status).toBe('downloaded')
  })

  it('transitions to not-available', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      statusCallback?.({ status: 'not-available' })
    })

    expect(result.current.status).toBe('not-available')
  })

  it('transitions to error with message', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      statusCallback?.({ status: 'error', data: 'Network timeout' })
    })

    expect(result.current.status).toBe('error')
    expect(result.current.error).toBe('Network timeout')
  })

  it('clears error on successful status', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      statusCallback?.({ status: 'error', data: 'Failed' })
    })
    expect(result.current.error).toBe('Failed')

    act(() => {
      statusCallback?.({ status: 'checking' })
    })
    expect(result.current.error).toBeNull()
  })

  it('checkForUpdates calls window.api', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      result.current.checkForUpdates()
    })

    expect(window.api.checkForUpdates).toHaveBeenCalledOnce()
  })

  it('downloadUpdate calls window.api', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      result.current.downloadUpdate()
    })

    expect(window.api.downloadUpdate).toHaveBeenCalledOnce()
  })

  it('installUpdate calls window.api', () => {
    const { result } = renderHook(() => useUpdater())

    act(() => {
      result.current.installUpdate()
    })

    expect(window.api.installUpdate).toHaveBeenCalledOnce()
  })

  it('handles missing window.api gracefully', () => {
    // @ts-expect-error -- cleanup
    delete window.api

    const { result } = renderHook(() => useUpdater())

    expect(result.current.status).toBe('idle')

    // Actions should not throw
    act(() => {
      result.current.checkForUpdates()
      result.current.downloadUpdate()
      result.current.installUpdate()
    })
  })

  it('cleans up subscription on unmount', () => {
    const { unmount } = renderHook(() => useUpdater())

    expect(statusCallback).toBeTruthy()

    unmount()

    expect(statusCallback).toBeNull()
  })
})
