import { EventEmitter } from 'events'
import type { ClaudeInstance, SessionHistoryEntry, InstanceUpdate } from '../renderer/lib/types'
import type { ProcessMonitor } from './process-monitor'

export class SessionTracker extends EventEmitter {
  private monitor: ProcessMonitor
  private maxHistoryEntries: number
  private instances: Map<number, ClaudeInstance> = new Map()
  private history: SessionHistoryEntry[] = []
  private intervalId: ReturnType<typeof setInterval> | null = null
  private polling = false

  constructor(monitor: ProcessMonitor, settings: { maxHistoryEntries: number }) {
    super()
    this.monitor = monitor
    this.maxHistoryEntries = settings.maxHistoryEntries
  }

  start(intervalMs: number): void {
    // Stop any existing interval
    this.stop()

    this.intervalId = setInterval(() => {
      this.doPoll()
    }, intervalMs)
  }

  stop(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  getInstances(): ClaudeInstance[] {
    return Array.from(this.instances.values())
  }

  getHistory(): SessionHistoryEntry[] {
    return [...this.history]
  }

  getStats(): {
    total: number
    active: number
    idle: number
    exited: number
    recentlyCompleted: number
  } {
    const instanceList = this.getInstances()
    const now = Date.now()
    const RECENT_WINDOW = 10 * 60 * 1000 // 10 minutes
    return {
      total: instanceList.length,
      active: instanceList.filter((i) => i.status === 'active').length,
      idle: instanceList.filter((i) => i.status === 'idle').length,
      exited: this.history.length,
      recentlyCompleted: instanceList.filter(
        (i) =>
          i.status === 'idle' &&
          i.lastBecameIdleAt &&
          now - new Date(i.lastBecameIdleAt).getTime() < RECENT_WINDOW
      ).length
    }
  }

  clearHistory(): void {
    this.history = []
  }

  private async doPoll(): Promise<void> {
    if (this.polling) return
    this.polling = true

    let currentProcesses: ClaudeInstance[]
    try {
      currentProcesses = await this.monitor.poll()
    } catch {
      // Silently skip this poll cycle on error
      this.polling = false
      return
    }

    const currentPids = new Set(currentProcesses.map((p) => p.pid))
    const previousPids = new Set(this.instances.keys())

    // Detect new instances
    for (const proc of currentProcesses) {
      if (!previousPids.has(proc.pid)) {
        this.emit('instance-appeared', proc)
      }
    }

    // Detect status changes for existing instances
    for (const proc of currentProcesses) {
      const prev = this.instances.get(proc.pid)
      if (prev && prev.status !== proc.status) {
        // Stamp lastBecameIdleAt when instance transitions active → idle
        if (prev.status === 'active' && proc.status === 'idle') {
          proc.lastBecameIdleAt = new Date()
        }
        this.emit('instance-status-changed', {
          instance: proc,
          previousStatus: prev.status
        })
      }
    }

    // Detect exited instances
    for (const [pid, instance] of this.instances) {
      if (!currentPids.has(pid)) {
        const now = new Date()
        const entry: SessionHistoryEntry = {
          pid: instance.pid,
          projectPath: instance.projectPath,
          projectName: instance.projectName,
          status: 'exited',
          startedAt: instance.startedAt,
          endedAt: now,
          durationSeconds: Math.max(
            0,
            Math.floor((now.getTime() - instance.startedAt.getTime()) / 1000)
          ),
          flags: instance.flags
        }

        this.history.push(entry)
        this.trimHistory()
        this.emit('instance-exited', entry)
      }
    }

    // Update current instances map — preserve startedAt and lastBecameIdleAt from previous polls
    const previousInstances = new Map(this.instances)
    this.instances.clear()
    for (const proc of currentProcesses) {
      const prev = previousInstances.get(proc.pid)
      if (prev) {
        proc.startedAt = prev.startedAt
        // Preserve idle timestamp unless status changed back to active
        if (prev.lastBecameIdleAt && proc.status === 'idle') {
          proc.lastBecameIdleAt = prev.lastBecameIdleAt
        }
      }
      this.instances.set(proc.pid, proc)
    }

    // Emit update event
    const update: InstanceUpdate = {
      instances: this.getInstances(),
      stats: this.getStats()
    }
    this.emit('update', update)
    this.polling = false
  }

  private trimHistory(): void {
    if (this.history.length > this.maxHistoryEntries) {
      this.history = this.history.slice(-this.maxHistoryEntries)
    }
  }
}
