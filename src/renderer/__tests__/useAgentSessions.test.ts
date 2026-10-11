import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAgentSessions } from '../hooks/useAgentSessions'
import { mockApi } from './api-mock'
import { NOW_MS, sessionFixture } from './fixtures'

const snapshotOf = (names: string[]) => ({
  rev: 1,
  generatedAtMs: NOW_MS,
  sessions: names.map((name) => sessionFixture({ key: `claude:${name}`, name })),
  sources: []
})

describe('useAgentSessions', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Reflect.deleteProperty(window, 'api')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is null while the app shell offers no office feed', () => {
    const { result } = renderHook(() => useAgentSessions())
    expect(result.current).toBeNull()
  })

  it('stays null when the feed has no snapshot yet', async () => {
    window.api = mockApi({ getOfficeSnapshot: vi.fn().mockResolvedValue(null) })
    const { result } = renderHook(() => useAgentSessions())
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current).toBeNull()
  })

  it('reads the sessions on mount and again on every poll', async () => {
    const getOfficeSnapshot = vi
      .fn()
      .mockResolvedValueOnce(snapshotOf(['one']))
      .mockResolvedValue(snapshotOf(['one', 'two']))
    window.api = mockApi({ getOfficeSnapshot })

    const { result } = renderHook(() => useAgentSessions())
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current?.map((session) => session.name)).toEqual(['one'])

    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(result.current?.map((session) => session.name)).toEqual(['one', 'two'])
  })

  it('keeps the array it already returned when a poll reads the same sessions', async () => {
    // Each read crosses IPC as a fresh copy, and the bridge raises `rev` on every poll.
    const getOfficeSnapshot = vi
      .fn()
      .mockImplementationOnce(async () => ({ ...snapshotOf(['one']), rev: 1 }))
      .mockImplementationOnce(async () => ({ ...snapshotOf(['one']), rev: 2 }))
      .mockImplementation(async () => ({ ...snapshotOf(['one', 'two']), rev: 3 }))
    window.api = mockApi({ getOfficeSnapshot })

    const { result } = renderHook(() => useAgentSessions())
    await act(() => vi.advanceTimersByTimeAsync(0))
    const first = result.current

    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(result.current).toBe(first)

    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(result.current).toHaveLength(2)
  })

  it('goes back to unknown when the feed loses its snapshot, so nothing stale stays up', async () => {
    const getOfficeSnapshot = vi
      .fn()
      .mockResolvedValueOnce(snapshotOf(['one']))
      .mockResolvedValue(null)
    window.api = mockApi({ getOfficeSnapshot })

    const { result } = renderHook(() => useAgentSessions())
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(result.current).toHaveLength(1)

    await act(() => vi.advanceTimersByTimeAsync(3000))
    expect(result.current).toBeNull()
  })

  it('stops polling when unmounted', async () => {
    const getOfficeSnapshot = vi.fn().mockResolvedValue(snapshotOf(['one']))
    window.api = mockApi({ getOfficeSnapshot })

    const { unmount } = renderHook(() => useAgentSessions())
    await act(() => vi.advanceTimersByTimeAsync(0))
    unmount()
    await vi.advanceTimersByTimeAsync(9000)

    expect(getOfficeSnapshot).toHaveBeenCalledOnce()
  })

  it('does not poll while the window is hidden, and reads again once it shows', async () => {
    const getOfficeSnapshot = vi.fn().mockResolvedValue(snapshotOf(['one']))
    window.api = mockApi({ getOfficeSnapshot })
    const visibility = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true)

    renderHook(() => useAgentSessions())
    await act(() => vi.advanceTimersByTimeAsync(9000))
    expect(getOfficeSnapshot).not.toHaveBeenCalled()

    visibility.mockReturnValue(false)
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'))
      await vi.advanceTimersByTimeAsync(0)
    })
    expect(getOfficeSnapshot).toHaveBeenCalledOnce()
    visibility.mockRestore()
  })

  it('keeps the last sessions when one read fails', async () => {
    const getOfficeSnapshot = vi
      .fn()
      .mockResolvedValueOnce(snapshotOf(['one']))
      .mockRejectedValue(new Error('ipc closed'))
    window.api = mockApi({ getOfficeSnapshot })

    const { result } = renderHook(() => useAgentSessions())
    await act(() => vi.advanceTimersByTimeAsync(0))
    await act(() => vi.advanceTimersByTimeAsync(3000))

    expect(result.current?.map((session) => session.name)).toEqual(['one'])
  })
})
