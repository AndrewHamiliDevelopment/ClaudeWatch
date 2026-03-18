import { readFile } from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'
import { BrowserWindow } from 'electron'
import type { UsageStats, ModelUsageEntry } from '../renderer/lib/types'

interface ClaudeJsonProject {
  lastModelUsage?: Record<
    string,
    {
      inputTokens: number
      outputTokens: number
      cacheReadInputTokens: number
      cacheCreationInputTokens: number
      costUSD: number
    }
  >
  lastTotalInputTokens?: number
  lastTotalOutputTokens?: number
  lastTotalCacheCreationInputTokens?: number
  lastTotalCacheReadInputTokens?: number
}

interface ClaudeJson {
  projects?: Record<string, ClaudeJsonProject>
}

const EMPTY_STATS: UsageStats = {
  totalInputTokens: 0,
  totalOutputTokens: 0,
  totalCacheReadTokens: 0,
  totalCacheCreationTokens: 0,
  totalCostUSD: 0,
  modelUsage: [],
  dataAvailable: false,
  lastUpdated: null
}

export class UsageStatsReader {
  private getWindows: (() => BrowserWindow | null)[]
  private interval: NodeJS.Timeout | null = null
  private lastData: UsageStats | null = null
  private filePath: string

  constructor(getWindows: (() => BrowserWindow | null)[]) {
    this.getWindows = getWindows
    this.filePath = join(homedir(), '.claude.json')
  }

  async read(): Promise<UsageStats> {
    let stats: UsageStats
    try {
      const raw = await readFile(this.filePath, 'utf-8')
      const data: ClaudeJson = JSON.parse(raw)

      if (!data.projects || typeof data.projects !== 'object') {
        stats = { ...EMPTY_STATS }
      } else {
        stats = this.aggregate(data.projects)
      }
    } catch {
      stats = { ...EMPTY_STATS }
    }

    this.lastData = stats
    this.send(stats)
    return stats
  }

  getLastData(): UsageStats | null {
    return this.lastData
  }

  startPolling(intervalMs = 30_000): void {
    this.read()
    this.interval = setInterval(() => this.read(), intervalMs)
  }

  stopPolling(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private aggregate(projects: Record<string, ClaudeJsonProject>): UsageStats {
    let totalInputTokens = 0
    let totalOutputTokens = 0
    let totalCacheReadTokens = 0
    let totalCacheCreationTokens = 0
    const modelMap = new Map<string, ModelUsageEntry>()

    for (const project of Object.values(projects)) {
      totalInputTokens += project.lastTotalInputTokens ?? 0
      totalOutputTokens += project.lastTotalOutputTokens ?? 0
      totalCacheReadTokens += project.lastTotalCacheReadInputTokens ?? 0
      totalCacheCreationTokens += project.lastTotalCacheCreationInputTokens ?? 0

      if (project.lastModelUsage) {
        for (const [model, usage] of Object.entries(project.lastModelUsage)) {
          const existing = modelMap.get(model)
          if (existing) {
            existing.inputTokens += usage.inputTokens ?? 0
            existing.outputTokens += usage.outputTokens ?? 0
            existing.cacheReadInputTokens += usage.cacheReadInputTokens ?? 0
            existing.cacheCreationInputTokens += usage.cacheCreationInputTokens ?? 0
            existing.costUSD += usage.costUSD ?? 0
          } else {
            modelMap.set(model, {
              model,
              inputTokens: usage.inputTokens ?? 0,
              outputTokens: usage.outputTokens ?? 0,
              cacheReadInputTokens: usage.cacheReadInputTokens ?? 0,
              cacheCreationInputTokens: usage.cacheCreationInputTokens ?? 0,
              costUSD: usage.costUSD ?? 0
            })
          }
        }
      }
    }

    // Sum cost from per-model data
    let totalCostUSD = 0
    for (const entry of modelMap.values()) {
      totalCostUSD += entry.costUSD
    }

    // Sort by cost descending
    const modelUsage = Array.from(modelMap.values()).sort((a, b) => b.costUSD - a.costUSD)

    return {
      totalInputTokens,
      totalOutputTokens,
      totalCacheReadTokens,
      totalCacheCreationTokens,
      totalCostUSD,
      modelUsage,
      dataAvailable: true,
      lastUpdated: new Date().toISOString()
    }
  }

  private send(data: UsageStats): void {
    for (const getWin of this.getWindows) {
      const win = getWin()
      if (win && !win.isDestroyed()) {
        win.webContents.send('usage:update', data)
      }
    }
  }
}
