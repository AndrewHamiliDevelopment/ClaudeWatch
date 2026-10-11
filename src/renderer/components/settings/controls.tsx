import { useId, type ReactNode } from 'react'
import { cn } from '../../lib/utils'
import { PLATE_TITLE_CLASS } from '../deck/deck-styles'
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
  valueText: string
  onChange: (value: number) => void
}

export function RangeSetting({
  label,
  value,
  min,
  max,
  step,
  valueText,
  onChange
}: RangeSettingProps) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-1.5 w-24 appearance-none rounded-full bg-track accent-accent"
        aria-label={label}
        aria-valuetext={valueText}
      />
      <span className="w-12 text-right text-xs tabular-nums text-text-secondary">{valueText}</span>
    </div>
  )
}
