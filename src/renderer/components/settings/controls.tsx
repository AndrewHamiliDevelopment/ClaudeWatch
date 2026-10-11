import { useId, useState, type ReactNode } from 'react'
import { clamp, type Range } from '../../../shared/range'
import { cn } from '../../lib/utils'
import { FIELD_CLASS, PLATE_TITLE_CLASS } from '../deck/deck-styles'
import { Plate } from '../deck/Plate'

interface ToggleSwitchProps {
  checked: boolean
  onChange: (isChecked: boolean) => void
  label: string
}

export function ToggleSwitch({ checked, onChange, label }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 rounded-full ring-1 ring-inset transition-colors',
        checked ? 'bg-accent ring-accent' : 'bg-track ring-border-strong'
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 size-5 rounded-full transition-transform',
          checked ? 'translate-x-5 bg-ink' : 'bg-text-secondary'
        )}
        aria-hidden="true"
      />
    </button>
  )
}

interface SettingRowProps {
  label: string
  description?: string
  children: ReactNode
}

export function SettingRow({ label, description, children }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="min-w-0">
        <p className="text-body font-semibold text-text-primary">{label}</p>
        {description && <p className="mt-0.5 text-xs text-text-secondary">{description}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId()
  return (
    <Plate className="shrink-0">
      <section aria-labelledby={headingId} className="px-4 pb-2 pt-3">
        <h2 id={headingId} className={cn(PLATE_TITLE_CLASS, 'mb-1')}>
          {title}
        </h2>
        {children}
      </section>
    </Plate>
  )
}

interface RangeSettingProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  formatValue: (value: number) => string
  onCommit: (value: number) => void
}

// Follows the drag on screen and saves when it ends: each save is an IPC call and a file write.
export function RangeSetting({
  label,
  value,
  min,
  max,
  step,
  formatValue,
  onCommit
}: RangeSettingProps) {
  const [draft, setDraft] = useState<number | null>(null)
  const shown = draft ?? value
  const valueText = formatValue(shown)

  const commit = (): void => {
    setDraft(null)
    if (draft !== null && draft !== value) onCommit(draft)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={shown}
        onChange={(event) => setDraft(Number(event.target.value))}
        onPointerUp={commit}
        onKeyUp={commit}
        onBlur={commit}
        className="h-1.5 w-24 appearance-none rounded-full bg-track accent-accent"
        aria-label={label}
        aria-valuetext={valueText}
      />
      <span className="w-12 text-right text-xs tabular-nums text-text-secondary">{valueText}</span>
    </div>
  )
}

interface NumberSettingProps {
  label: string
  name: string
  value: number
  range: Range
  step: number
  unit: string
  onCommit: (value: number) => void
}

// Saves on blur or Enter, not per keystroke: a half-typed number would be pulled into range
// and rewritten under the cursor.
export function NumberSetting({
  label,
  name,
  value,
  range,
  step,
  unit,
  onCommit
}: NumberSettingProps) {
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (): void => {
    const typed = draft === null ? Number.NaN : parseInt(draft, 10)
    setDraft(null)
    if (Number.isNaN(typed)) return
    const next = clamp(typed, range)
    if (next !== value) onCommit(next)
  }

  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        name={name}
        autoComplete="off"
        inputMode="numeric"
        min={range[0]}
        max={range[1]}
        step={step}
        value={draft ?? value}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') commit()
        }}
        className={`${FIELD_CLASS} h-8 w-28 px-2 text-right tabular-nums`}
        aria-label={label}
      />
      <span className="text-xs text-text-secondary">{unit}</span>
    </div>
  )
}
