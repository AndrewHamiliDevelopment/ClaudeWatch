import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { WidgetStatsWriter, createWidgetStatsWriter } from './widget-stats-writer'
import type { ClaudeInstance, InstanceUpdate } from '../renderer/lib/types'
import { readFile, rm, access } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import { execFile } from 'child_process'

// Use a temp directory for tests instead of real App Group container
const TEST_CONTAINER = join(tmpdir(), 'claudewatch-test-widget')

vi.mock('os', async () => {
  const actual = await vi.importActual<typeof import('os')>('os')
  return {
    ...actual,
    homedir: vi.fn(() => join(tmpdir(), 'claudewatch-test-home'))
  }
})

vi.mock('child_process', async () => {
  const actual = await vi.importActual<typeof import('child_process')>('child_process')
  return {
    ...actual,
    execFile: vi.fn(
      (_cmd: string, _args: string[], _opts: unknown, cb?: (err: Error | null) => void) => {
        if (cb) cb(null)
        return { unref: vi.fn() }
      }
    )
  }
})

function makeInstance(overrides: Partial<ClaudeInstance> = {}): ClaudeInstance {
  return {
    pid: 1234,
    tty: 'ttys001',
    status: 'active',
    cpuPercent: 45.2,
    memPercent: 1.3,
    elapsedTime: '01:23:45',
    elapsedSeconds: 5025,
    projectPath: '/Users/angelo/project-alpha',
    projectName: 'project-alpha',
    flags: ['--continue'],
    startedAt: new Date('2026-03-18T10:00:00Z'),
    ...overrides
  }
}

function makeStats(overrides: Partial<InstanceUpdate['stats']> = {}): InstanceUpdate['stats'] {
  return {
    total: 3,
    active: 2,
    idle: 1,
    exited: 0,
    ...overrides
  }
}

describe('WidgetStatsWriter', () => {
  let writer: WidgetStatsWriter

  beforeEach(() => {
    writer = new WidgetStatsWriter()
  })

  afterEach(async () => {
    // Clean up test files
    try {
      await rm(writer.getContainerPath(), { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('write()', () => {
    it('should write valid JSON to the stats file', async () => {
      const instances = [makeInstance()]
      const stats = makeStats({ total: 1, active: 1, idle: 0 })

      await writer.write(instances, stats)

      const content = await readFile(writer.getStatsPath(), 'utf-8')
      const payload = JSON.parse(content)

      expect(payload.updatedAt).toBeDefined()
      expect(new Date(payload.updatedAt).toISOString()).toBe(payload.updatedAt)
      expect(payload.stats).toEqual({ total: 1, active: 1, idle: 0, exited: 0 })
      expect(payload.instances).toHaveLength(1)
      expect(payload.instances[0]).toEqual({
        pid: 1234,
        projectName: 'project-alpha',
        status: 'active',
        cpuPercent: 45.2,
        memPercent: 1.3,
        elapsedSeconds: 5025
      })
    })

    it('should create container directory if it does not exist', async () => {
      // Ensure it does not exist
      await rm(writer.getContainerPath(), { recursive: true, force: true }).catch(() => {})

      await writer.write([makeInstance()], makeStats())

      // File should exist now
      const content = await readFile(writer.getStatsPath(), 'utf-8')
      expect(JSON.parse(content).stats).toBeDefined()
    })

    it('should filter out exited instances', async () => {
      const instances = [
        makeInstance({ pid: 1, status: 'active' }),
        makeInstance({ pid: 2, status: 'exited' }),
        makeInstance({ pid: 3, status: 'idle' })
      ]

      await writer.write(instances, makeStats())

      const content = await readFile(writer.getStatsPath(), 'utf-8')
      const payload = JSON.parse(content)

      expect(payload.instances).toHaveLength(2)
      expect(payload.instances.map((i: { pid: number }) => i.pid)).toEqual([1, 3])
    })

    it('should sort active instances before idle', async () => {
      const instances = [
        makeInstance({ pid: 1, status: 'idle' }),
        makeInstance({ pid: 2, status: 'active' }),
        makeInstance({ pid: 3, status: 'idle' }),
        makeInstance({ pid: 4, status: 'active' })
      ]

      await writer.write(instances, makeStats())

      const content = await readFile(writer.getStatsPath(), 'utf-8')
      const payload = JSON.parse(content)

      const statuses = payload.instances.map((i: { status: string }) => i.status)
      expect(statuses).toEqual(['active', 'active', 'idle', 'idle'])
    })

    it('should handle empty instances array', async () => {
      await writer.write([], makeStats({ total: 0, active: 0, idle: 0 }))

      const content = await readFile(writer.getStatsPath(), 'utf-8')
      const payload = JSON.parse(content)

      expect(payload.instances).toEqual([])
      expect(payload.stats.total).toBe(0)
    })

    it('should overwrite previous stats file on subsequent writes', async () => {
      await writer.write([makeInstance({ pid: 1 })], makeStats({ total: 1, active: 1 }))
      await writer.write(
        [makeInstance({ pid: 2 }), makeInstance({ pid: 3 })],
        makeStats({ total: 2, active: 2 })
      )

      const content = await readFile(writer.getStatsPath(), 'utf-8')
      const payload = JSON.parse(content)

      expect(payload.stats.total).toBe(2)
      expect(payload.instances).toHaveLength(2)
    })

    it('should only include expected fields in instance data', async () => {
      const instances = [
        makeInstance({
          pid: 42,
          sessionId: 'secret-session-id',
          flags: ['--resume', 'abc123']
        })
      ]

      await writer.write(instances, makeStats())

      const content = await readFile(writer.getStatsPath(), 'utf-8')
      const payload = JSON.parse(content)
      const instance = payload.instances[0]

      // Should NOT include sensitive or unnecessary fields
      expect(instance.sessionId).toBeUndefined()
      expect(instance.flags).toBeUndefined()
      expect(instance.projectPath).toBeUndefined()
      expect(instance.tty).toBeUndefined()
      expect(instance.startedAt).toBeUndefined()

      // Should include only widget-relevant fields
      expect(Object.keys(instance).sort()).toEqual(
        ['cpuPercent', 'elapsedSeconds', 'memPercent', 'pid', 'projectName', 'status'].sort()
      )
    })
  })

  describe('ensureContainer()', () => {
    it('should not throw if container already exists', async () => {
      await writer.ensureContainer()
      await expect(writer.ensureContainer()).resolves.not.toThrow()
    })
  })

  describe('writeToUserDefaults()', () => {
    beforeEach(() => {
      vi.mocked(execFile).mockClear()
    })

    it('should call defaults write after file write', async () => {
      const instances = [makeInstance()]
      const stats = makeStats({ total: 1, active: 1, idle: 0 })

      await writer.write(instances, stats)

      expect(execFile).toHaveBeenCalledTimes(1)
      const [cmd, args] = vi.mocked(execFile).mock.calls[0] as [string, string[], unknown, unknown]
      expect(cmd).toBe('defaults')
      expect(args[0]).toBe('write')
      expect(args[1]).toBe('group.com.zkidzdev.claudewatch')
      expect(args[2]).toBe('statsJson')
      expect(args[3]).toBe('-string')
      // The 5th arg should be the JSON string
      const jsonArg = args[4]
      const parsed = JSON.parse(jsonArg)
      expect(parsed.stats.total).toBe(1)
    })

    it('should not break file write if defaults write fails', async () => {
      vi.mocked(execFile).mockImplementation(
        (_cmd: string, _args: string[], _opts: unknown, cb?: (err: Error | null) => void) => {
          if (cb) cb(new Error('defaults command not found'))
          return { unref: vi.fn() } as unknown as ReturnType<typeof execFile>
        }
      )

      const instances = [makeInstance()]
      const stats = makeStats({ total: 1, active: 1, idle: 0 })

      // write() should still succeed (no thrown error)
      await expect(writer.write(instances, stats)).resolves.not.toThrow()

      // File should still be written
      const content = await readFile(writer.getStatsPath(), 'utf-8')
      const payload = JSON.parse(content)
      expect(payload.stats.total).toBe(1)
    })

    it('should handle JSON with special characters', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      const jsonWithQuotes = '{"project":"it\'s a test","status":"active"}'

      writer.writeToUserDefaults(jsonWithQuotes)

      expect(execFile).toHaveBeenCalledTimes(1)
      const [, args] = vi.mocked(execFile).mock.calls[0] as [string, string[], unknown, unknown]
      // execFile passes args as array elements, no shell escaping needed
      expect(args[4]).toBe(jsonWithQuotes)
      warnSpy.mockRestore()
    })
  })
})

describe('createWidgetStatsWriter()', () => {
  it('should return WidgetStatsWriter on darwin', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'darwin' })

    const writer = createWidgetStatsWriter()
    expect(writer).toBeInstanceOf(WidgetStatsWriter)

    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
  })

  it('should return null on non-darwin platforms', () => {
    const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
    Object.defineProperty(process, 'platform', { value: 'win32' })

    const writer = createWidgetStatsWriter()
    expect(writer).toBeNull()

    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
  })
})
