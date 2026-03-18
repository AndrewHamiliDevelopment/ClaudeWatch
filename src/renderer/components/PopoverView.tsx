import { useState, useEffect, useMemo } from 'react'
import { Activity, Moon, XCircle, CheckCircle, Cpu, MemoryStick } from 'lucide-react'
import { cn, formatElapsedTime, formatCompactNumber, formatCurrency, timeAgo } from '../lib/utils'
import { useUsage } from '../hooks/useUsage'
import { usePromoStatus } from '../hooks/usePromoStatus'
import type { ClaudeInstance, InstanceUpdate } from '../lib/types'

const RECENT_WINDOW_MS = 10 * 60 * 1000

const emptyStats: InstanceUpdate['stats'] = {
  total: 0,
  active: 0,
  idle: 0,
  exited: 0,
  recentlyCompleted: 0
}

const statusColors: Record<ClaudeInstance['status'], string> = {
  active: 'bg-status-active',
  idle: 'bg-status-idle',
  exited: 'bg-status-exited'
}

const statusIcons: Record<ClaudeInstance['status'], typeof Activity> = {
  active: Activity,
  idle: Moon,
  exited: XCircle
}

interface GroupedInstances {
  recentlyCompleted: ClaudeInstance[]
  inProgress: ClaudeInstance[]
  waiting: ClaudeInstance[]
}

export function PopoverView() {
  const [instances, setInstances] = useState<ClaudeInstance[]>([])
  const [stats, setStats] = useState(emptyStats)
  const { usage } = useUsage()
  const { promo } = usePromoStatus()

  useEffect(() => {
    if (typeof window === 'undefined' || !window.api) return

    window.api.getInstances().then((data) => {
      setInstances(data.instances)
      setStats(data.stats)
    })

    const unsubscribe = window.api.onInstancesUpdate((data) => {
      setInstances(data.instances)
      setStats(data.stats)
    })

    return unsubscribe
  }, [])

  const sorted = [...instances].sort((a, b) => {
    const order: Record<string, number> = { active: 0, idle: 1, exited: 2 }
    const diff = (order[a.status] ?? 3) - (order[b.status] ?? 3)
    if (diff !== 0) return diff
    return b.cpuPercent - a.cpuPercent
  })

  const grouped = useMemo((): GroupedInstances => {
    const now = Date.now()
    const recentlyCompleted: ClaudeInstance[] = []
    const inProgress: ClaudeInstance[] = []
    const waiting: ClaudeInstance[] = []

    for (const inst of sorted) {
      if (inst.status === 'active') {
        inProgress.push(inst)
      } else if (
        inst.status === 'idle' &&
        inst.lastBecameIdleAt &&
        now - new Date(inst.lastBecameIdleAt).getTime() < RECENT_WINDOW_MS
      ) {
        recentlyCompleted.push(inst)
      } else {
        waiting.push(inst)
      }
    }

    return { recentlyCompleted, inProgress, waiting }
  }, [sorted])

  const hasGroupedContent =
    grouped.recentlyCompleted.length > 0 ||
    grouped.inProgress.length > 0 ||
    grouped.waiting.length > 0

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-surface">
      {/* Compact header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-heading text-text-primary">ClaudeWatch</span>
          {promo?.is2x && (
            <span className="rounded-full bg-status-active/20 px-1.5 py-0.5 text-[10px] font-semibold text-status-active">
              2x
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-mono-sm tabular-nums">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-status-active" />
            <span className="text-status-active">{stats.active}</span>
          </span>
          {stats.recentlyCompleted > 0 && (
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
              <span className="text-emerald-400">{stats.recentlyCompleted}</span>
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-status-idle" />
            <span className="text-status-idle">{stats.idle}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-status-exited" />
            <span className="text-status-exited">{stats.exited}</span>
          </span>
        </div>
      </div>

      {/* Usage bar */}
      {usage?.dataAvailable && (
        <div className="border-b border-border px-4 py-2 text-[11px] tabular-nums text-text-secondary">
          {formatCurrency(usage.totalCostUSD)} &middot;{' '}
          {formatCompactNumber(usage.totalInputTokens)} in &middot;{' '}
          {formatCompactNumber(usage.totalOutputTokens)} out
        </div>
      )}

      {/* Instance list with groups */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!hasGroupedContent ? (
          <div className="flex h-full items-center justify-center px-4 py-8">
            <span className="text-body text-text-tertiary">No instances detected</span>
          </div>
        ) : (
          <div>
            {grouped.recentlyCompleted.length > 0 && (
              <PopoverSection
                label="Recently Done"
                colorClass="text-emerald-400"
                instances={grouped.recentlyCompleted}
                iconOverride={CheckCircle}
                dotColor="bg-emerald-400"
              />
            )}
            {grouped.inProgress.length > 0 && (
              <PopoverSection
                label="In Progress"
                colorClass="text-status-active"
                instances={grouped.inProgress}
              />
            )}
            {grouped.waiting.length > 0 && (
              <PopoverSection
                label="Waiting"
                colorClass="text-status-idle"
                instances={grouped.waiting}
              />
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 border-t border-border px-4 py-3">
        <button
          type="button"
          onClick={() => window.api?.openDashboard()}
          className="flex-1 rounded-md bg-accent/15 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
        >
          Open Dashboard
        </button>
        <button
          type="button"
          onClick={() => window.api?.quit()}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-text-tertiary transition-colors hover:bg-surface-hover hover:text-text-secondary"
        >
          Quit
        </button>
      </div>
    </div>
  )
}

function PopoverSection({
  label,
  colorClass,
  instances,
  iconOverride,
  dotColor
}: {
  label: string
  colorClass: string
  instances: ClaudeInstance[]
  iconOverride?: typeof Activity
  dotColor?: string
}) {
  return (
    <div>
      <div
        className={cn('px-4 py-1.5 text-[9px] font-semibold uppercase tracking-widest', colorClass)}
      >
        {label}
      </div>
      <div className="divide-y divide-border">
        {instances.map((inst) => (
          <PopoverInstanceRow
            key={inst.pid}
            instance={inst}
            iconOverride={iconOverride}
            dotColor={dotColor}
          />
        ))}
      </div>
    </div>
  )
}

function PopoverInstanceRow({
  instance,
  iconOverride,
  dotColor
}: {
  instance: ClaudeInstance
  iconOverride?: typeof Activity
  dotColor?: string
}) {
  const [elapsed, setElapsed] = useState(instance.elapsedSeconds)

  useEffect(() => {
    setElapsed(instance.elapsedSeconds)

    if (instance.status !== 'active' && instance.status !== 'idle') return

    const interval = setInterval(() => {
      setElapsed((prev) => prev + 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [instance.elapsedSeconds, instance.status, instance.pid])

  const StatusIcon = iconOverride ?? statusIcons[instance.status]
  const resolvedDotColor = dotColor ?? statusColors[instance.status]

  const idleAgo =
    instance.lastBecameIdleAt && instance.status === 'idle'
      ? timeAgo(new Date(instance.lastBecameIdleAt))
      : null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {/* Status dot */}
      <span
        className={cn(
          'inline-block h-2 w-2 shrink-0 rounded-full',
          resolvedDotColor,
          instance.status === 'active' && !dotColor && 'animate-pulse-dot'
        )}
      />

      {/* Project name + metrics */}
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-text-primary">
          {instance.projectName}
        </span>
        <div className="mt-0.5 flex items-center gap-3 text-[10px] text-text-tertiary">
          <span className="tabular-nums">{idleAgo ?? formatElapsedTime(elapsed)}</span>
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <Cpu className="h-2.5 w-2.5" aria-hidden="true" />
            {instance.cpuPercent.toFixed(1)}%
          </span>
          <span className="inline-flex items-center gap-0.5 tabular-nums">
            <MemoryStick className="h-2.5 w-2.5" aria-hidden="true" />
            {instance.memPercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {/* Status icon */}
      <StatusIcon
        className={cn('h-3 w-3 shrink-0', {
          'text-emerald-400': !!iconOverride,
          'text-status-active': !iconOverride && instance.status === 'active',
          'text-status-idle': !iconOverride && instance.status === 'idle',
          'text-status-exited': !iconOverride && instance.status === 'exited'
        })}
        aria-label={instance.status}
      />
    </div>
  )
}
