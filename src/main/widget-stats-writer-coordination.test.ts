import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockWriteFile = vi.hoisted(() => vi.fn())
const mockRename = vi.hoisted(() => vi.fn())
const mockMkdir = vi.hoisted(() => vi.fn())
const mockHomedir = vi.hoisted(() => vi.fn(() => '/Users/test'))

vi.mock('fs/promises', () => ({
  writeFile: mockWriteFile,
  rename: mockRename,
  mkdir: mockMkdir
}))

vi.mock('os', () => ({
  homedir: mockHomedir
}))

import { WidgetStatsWriter } from './widget-stats-writer'

describe('WidgetStatsWriter coordination', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockMkdir.mockResolvedValue(undefined)
    mockWriteFile.mockResolvedValue(undefined)
    mockRename.mockResolvedValue(undefined)
  })

  it('serializes concurrent writes so only one primary rename starts at a time', async () => {
    let releaseFirstRename: (() => void) | undefined
    const firstRename = new Promise<void>((resolve) => {
      releaseFirstRename = resolve
    })

    // First rename (primary write) blocks; all subsequent renames resolve immediately
    mockRename.mockImplementationOnce(() => firstRename).mockResolvedValue(undefined)

    const writer = new WidgetStatsWriter()
    const firstWrite = writer.write([], {
      total: 1,
      active: 1,
      idle: 0,
      stale: 0,
      exited: 0,
      recentlyCompleted: 0
    })
    const secondWrite = writer.write([], {
      total: 2,
      active: 2,
      idle: 0,
      stale: 0,
      exited: 0,
      recentlyCompleted: 0
    })

    // Wait for the first primary rename to be called
    await vi.waitFor(() => {
      expect(mockRename.mock.calls.length).toBeGreaterThan(0)
    })

    // Only the first write's primary rename should have been called so far
    // (the second write is queued behind it)
    expect(mockRename).toHaveBeenCalledTimes(1)

    releaseFirstRename?.()
    await Promise.all([firstWrite, secondWrite])

    // After both writes complete: each write does 1 primary rename + 2 sandbox replicas = 3 per write
    // Total = 6 renames (3 per write × 2 writes)
    expect(mockRename).toHaveBeenCalledTimes(6)
  })

  it('waits for sandbox replication before starting the next write', async () => {
    let releaseFirstSandboxRename: (() => void) | undefined

    // Primary rename resolves immediately, but second rename (first sandbox replica) blocks
    mockRename
      .mockResolvedValueOnce(undefined) // first write: primary rename
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirstSandboxRename = resolve
          })
      ) // first write: first sandbox replica
      .mockResolvedValue(undefined) // all subsequent renames

    const writer = new WidgetStatsWriter()
    const firstWrite = writer.write([], {
      total: 1,
      active: 1,
      idle: 0,
      stale: 0,
      exited: 0,
      recentlyCompleted: 0
    })
    const secondWrite = writer.write([], {
      total: 2,
      active: 2,
      idle: 0,
      stale: 0,
      exited: 0,
      recentlyCompleted: 0
    })

    // Wait for the sandbox rename to be called (2nd rename)
    await vi.waitFor(() => {
      expect(mockRename.mock.calls.length).toBeGreaterThanOrEqual(2)
    })

    // Second write should still be waiting (sandbox replication hasn't finished)
    expect(mockRename).toHaveBeenCalledTimes(2)

    releaseFirstSandboxRename?.()
    await Promise.all([firstWrite, secondWrite])

    // All renames should now be complete
    expect(mockRename.mock.calls.length).toBeGreaterThanOrEqual(4)
  })
})
