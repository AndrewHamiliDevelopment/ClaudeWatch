import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useInstances } from '../hooks/useInstances'
import type { ClaudeInstance, InstanceUpdate } from '../lib/types'
import { mockApi } from './api-mock'

const mockInstance = (overrides: Partial<ClaudeInstance> = {}): ClaudeInstance => ({
  pid: 1234,
  tty: '/dev/ttys001',
  status: 'active',
  cpuPercent: 12.5,
  memPercent: 3.2,
  elapsedTime: '5:30',
  elapsedSeconds: 330,
  projectPath: '/Users/test/projects/my-app',
  projectName: 'projects/my-app',
  flags: ['--model', 'opus'],
  sessionId: 'abc-123',
  startedAt: new Date('2026-03-18T10:00:00'),
  lastStatusChange: new Date('2026-03-18T10:05:00'),
  ...overrides
})

const mockUpdate: InstanceUpdate = {
  instances: [
    mockInstance(),
    mockInstance({
      pid: 5678,
      status: 'idle',
      projectPath: '/Users/test/projects/other',
      projectName: 'projects/other'
    }),
    mockInstance({
      pid: 9999,
      status: 'exited',
      projectPath: '/Users/test/projects/done',
      projectName: 'projects/done'
    })
  ],
  stats: { total: 3, active: 1, idle: 1, stale: 0, exited: 1, recentlyCompleted: 0 }
}

describe('useInstances', () => {
  let unsubscribe: ReturnType<typeof vi.fn>

  beforeEach(() => {
    unsubscribe = vi.fn()
    window.api = mockApi({
      getInstances: vi.fn().mockResolvedValue(mockUpdate),
      getSettings: vi.fn(),
      setSettings: vi.fn(),
      getHistory: vi.fn(),
      clearHistory: vi.fn(),
      openDashboard: vi.fn(),
      quit: vi.fn(),
      onInstancesUpdate: vi.fn().mockReturnValue(unsubscribe)
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
    // @ts-expect-error -- cleanup
    delete window.api
  })

  it('fetches initial instances on mount', async () => {
    const { result } = renderHook(() => useInstances())

    await waitFor(() => {
      expect(result.current.length).toBe(3)
    })
    expect(window.api.getInstances).toHaveBeenCalledOnce()
  })

  it('subscribes to instance updates on mount and unsubscribes on unmount', async () => {
    const { unmount } = renderHook(() => useInstances())

    await waitFor(() => {
      expect(window.api.onInstancesUpdate).toHaveBeenCalledOnce()
    })

    unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })

  it('updates instances when onInstancesUpdate fires', async () => {
    const { result } = renderHook(() => useInstances())

    await waitFor(() => {
      expect(result.current.length).toBe(3)
    })

    const newUpdate: InstanceUpdate = {
      instances: [mockInstance({ pid: 1111, status: 'active' })],
      stats: { total: 1, active: 1, idle: 0, stale: 0, exited: 0, recentlyCompleted: 0 }
    }

    const callback = (window.api.onInstancesUpdate as ReturnType<typeof vi.fn>).mock.calls[0][0]
    act(() => {
      callback(newUpdate)
    })

    expect(result.current.length).toBe(1)
  })

  it('handles missing window.api gracefully', async () => {
    // @ts-expect-error -- cleanup
    delete window.api

    const { result } = renderHook(() => useInstances())

    expect(result.current).toEqual([])
  })
})
