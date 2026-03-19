import { useState, useEffect, useRef } from 'react'
import { ChevronDown, Cpu, MemoryStick, Terminal, ExternalLink } from 'lucide-react'
import { cn, formatElapsedTime } from '../lib/utils'
import type { ClaudeInstance } from '../lib/types'
import { StatusBadge } from './StatusBadge'

interface InstanceCardProps {
  instance: ClaudeInstance
}

export function InstanceCard({ instance }: InstanceCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [elapsed, setElapsed] = useState(instance.elapsedSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }

    setElapsed(instance.elapsedSeconds)

    if (instance.status === 'active' || instance.status === 'idle' || instance.status === 'stale') {
      intervalRef.current = setInterval(() => {
        setElapsed((prev) => prev + 1)
      }, 1000)
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [instance.elapsedSeconds, instance.status, instance.pid])

  const handleOpenTerminal = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (typeof window !== 'undefined' && window.api?.openTerminal) {
      window.api.openTerminal(instance.projectPath, instance.terminalType)
    }
  }

  return (
    <div className="card-interactive no-drag animate-fade-in overflow-hidden">
      <button
        type="button"
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        aria-label={`${instance.projectName} - ${instance.status}`}
      >
        {/* Status dot */}
        <StatusBadge status={instance.status} showLabel={false} />

        {/* Project info */}
        <div className="min-w-0 flex-1">
          <span className="block truncate text-heading text-text-primary">
            {instance.projectName}
          </span>
          <span className="block truncate font-mono text-caption text-text-tertiary">
            {instance.projectPath}
          </span>
        </div>

        {/* Metrics cluster — right aligned */}
        <div className="flex items-center gap-4 text-mono-sm text-text-secondary">
          <span className="tabular-nums" aria-label="Elapsed time">
            {formatElapsedTime(elapsed)}
          </span>
          <span
            className="inline-flex items-center gap-1 tabular-nums"
            aria-label={`CPU: ${instance.cpuPercent.toFixed(1)}%`}
          >
            <Cpu className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
            {instance.cpuPercent.toFixed(1)}%
          </span>
          <span
            className="inline-flex items-center gap-1 tabular-nums"
            aria-label={`Memory: ${instance.memPercent.toFixed(1)}%`}
          >
            <MemoryStick className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
            {instance.memPercent.toFixed(1)}%
          </span>
          <ChevronDown
            className={cn(
              'h-4 w-4 text-text-tertiary transition-transform duration-150',
              expanded && 'rotate-180'
            )}
            aria-hidden="true"
          />
        </div>
      </button>

      {/* Expanded detail panel */}
      {expanded && (
        <div
          className="border-t border-border px-4 py-3 text-mono-sm text-text-secondary"
          role="region"
          aria-label="Instance details"
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="flex items-center gap-1.5">
              <Terminal className="h-3 w-3 text-text-tertiary" aria-hidden="true" />
              <span>PID: {instance.pid}</span>
            </div>
            <div>
              <span>Terminal: {instance.terminalApp ?? instance.tty}</span>
            </div>
            {instance.sessionId && (
              <div className="truncate">
                <span>Session: {instance.sessionId}</span>
              </div>
            )}
          </div>
          {instance.sessionType && instance.sessionType !== 'cli' && (
            <div className="mt-1">
              <span className="inline-flex items-center rounded-full bg-accent/10 px-2 py-0.5 text-xs font-medium text-accent">
                {instance.sessionType}
              </span>
            </div>
          )}
          {instance.flags.length > 0 && (
            <div className="mt-2 text-text-tertiary">Flags: {instance.flags.join(' ')}</div>
          )}
          <div className="mt-3 flex justify-end">
            <button
              type="button"
              onClick={handleOpenTerminal}
              className="inline-flex items-center gap-1.5 rounded-md bg-accent/10 px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20"
              aria-label={`Open in ${instance.terminalApp ?? 'Terminal'}`}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              Open in {instance.terminalApp ?? 'Terminal'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
