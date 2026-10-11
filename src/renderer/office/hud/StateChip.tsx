import { Check, CircleHelp, Diamond, Hand, Hourglass, X, type LucideIcon } from 'lucide-react'
import type { GemKind, GemSpec } from '../logic/status-gem'

const GEM_ICON: Record<GemKind, LucideIcon> = {
  permission: Hand,
  question: CircleHelp,
  done: Check,
  error: X,
  limited: Hourglass,
  working: Diamond
}

export function StateIcon({ spec }: { spec: GemSpec }) {
  const Icon = GEM_ICON[spec.kind]
  return (
    <Icon
      aria-hidden="true"
      className="size-3.5 shrink-0"
      style={{ color: spec.color }}
      strokeWidth={2.5}
    />
  )
}

// Icon carries the state colour; the label stays high-contrast text so colour is never the only cue.
export function StateChip({ spec }: { spec: GemSpec }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-body text-text-primary">
      <StateIcon spec={spec} />
      {spec.label}
    </span>
  )
}
