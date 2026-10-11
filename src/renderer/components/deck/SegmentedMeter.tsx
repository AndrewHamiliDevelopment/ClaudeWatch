import type { CSSProperties } from 'react'
import { clamp } from '../../../shared/range'
import { cn } from '../../lib/utils'

interface SegmentedMeterProps {
  label: string
  percent: number
  // What the caller prints beside the meter; the empty track alone is too faint to read.
  valueText: string
  // Past this point the fill runs hot and a tick shows where it starts.
  markPercent?: number
  className?: string
}

type MeterStyle = CSSProperties & Record<'--fill' | '--mark', string>

export function SegmentedMeter({
  label,
  percent,
  valueText,
  markPercent,
  className
}: SegmentedMeterProps) {
  const clampedPercent = clamp(percent, [0, 100])
  const fillStyle: MeterStyle = {
    '--fill': `${clampedPercent}%`,
    '--mark': `${markPercent ?? 100}%`
  }

  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuenow={Math.round(clampedPercent)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      className={cn('relative', className)}
    >
      <div className="meter-fill" style={fillStyle} />
      {markPercent !== undefined && (
        <span
          aria-hidden="true"
          className="absolute -top-[3px] h-3.5 w-[1.5px] bg-text-secondary"
          style={{ left: `${markPercent}%` }}
        />
      )}
    </div>
  )
}
