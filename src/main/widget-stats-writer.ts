import { writeFile, mkdir, rename, access } from 'fs/promises'
import { join } from 'path'
import { homedir, tmpdir } from 'os'
import type { ClaudeInstance, InstanceUpdate } from '../renderer/lib/types'

const APP_GROUP_ID = 'group.com.zkidzdev.claudewatch'

export interface WidgetInstanceData {
  pid: number
  projectName: string
  status: 'active' | 'idle' | 'exited'
  cpuPercent: number
  memPercent: number
  elapsedSeconds: number
}

export interface WidgetStatsPayload {
  updatedAt: string
  stats: {
    total: number
    active: number
    idle: number
    exited: number
  }
  instances: WidgetInstanceData[]
}

export class WidgetStatsWriter {
  private containerPath: string
  private statsPath: string
  private containerReady = false

  constructor() {
    this.containerPath = join(homedir(), 'Library/Group Containers', APP_GROUP_ID)
    this.statsPath = join(this.containerPath, 'stats.json')
  }

  getStatsPath(): string {
    return this.statsPath
  }

  getContainerPath(): string {
    return this.containerPath
  }

  async ensureContainer(): Promise<void> {
    if (this.containerReady) return
    try {
      await mkdir(this.containerPath, { recursive: true })
      this.containerReady = true
    } catch {
      // Container may already exist or permissions issue — will fail on write
    }
  }

  async write(instances: ClaudeInstance[], stats: InstanceUpdate['stats']): Promise<void> {
    await this.ensureContainer()

    const payload: WidgetStatsPayload = {
      updatedAt: new Date().toISOString(),
      stats: {
        total: stats.total,
        active: stats.active,
        idle: stats.idle,
        exited: stats.exited
      },
      instances: instances
        .filter((i) => i.status !== 'exited')
        .sort((a, b) => {
          // Active first, then idle
          if (a.status === 'active' && b.status !== 'active') return -1
          if (a.status !== 'active' && b.status === 'active') return 1
          return 0
        })
        .map((i) => ({
          pid: i.pid,
          projectName: i.projectName,
          status: i.status,
          cpuPercent: i.cpuPercent,
          memPercent: i.memPercent,
          elapsedSeconds: i.elapsedSeconds
        }))
    }

    // Atomic write: write to temp file, then rename
    const tmpPath = join(tmpdir(), `claudewatch-stats-${process.pid}.json`)
    await writeFile(tmpPath, JSON.stringify(payload, null, 2), 'utf-8')
    await rename(tmpPath, this.statsPath)
  }
}

/**
 * Create a WidgetStatsWriter only on macOS.
 * Returns null on other platforms.
 */
export function createWidgetStatsWriter(): WidgetStatsWriter | null {
  if (process.platform !== 'darwin') return null
  return new WidgetStatsWriter()
}
