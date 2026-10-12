import { useEffect, useState } from 'react'
import { Plate } from '../../components/deck/Plate'
import type { FrameMetrics } from '../frame-metrics'
import { levelInUse, QUALITY_PINS, type QualityPin } from '../logic/quality'
import { pinQuality, useQualityChoice } from '../quality-store'
import { BAR_BUTTON_CLASS } from './hud-styles'

const REFRESH_MS = 500

const PIN_LABEL: Record<QualityPin, string> = {
  auto: 'Auto',
  full: 'Full',
  balanced: 'Balanced',
  light: 'Light'
}

export function MetricsOverlay({ metrics }: { metrics: FrameMetrics }) {
  const [shown, setShown] = useState<FrameMetrics>(() => ({ ...metrics }))
  const { pin, chosen } = useQualityChoice()
  useEffect(() => {
    const timer = setInterval(() => setShown({ ...metrics }), REFRESH_MS)
    return () => clearInterval(timer)
  }, [metrics])

  const rows: readonly [string, string][] = [
    ['fps', shown.fps.toFixed(0)],
    ['frame ms', shown.frameMs.toFixed(1)],
    ['draw calls', String(shown.drawCalls)],
    ['triangles', shown.triangles.toLocaleString()],
    ['detail', `${levelInUse(pin, chosen)}, ${pin === 'auto' ? 'chosen' : 'pinned'}`]
  ]
  return (
    <Plate>
      <dl
        aria-label="Render metrics"
        className="grid grid-cols-[auto_auto] gap-x-3 px-3 pt-2 font-mono text-mono-sm"
      >
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-text-secondary">{term}</dt>
            <dd className="text-right tabular-nums text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
      <div role="group" aria-label="Detail level" className="flex gap-1 px-2 pb-2 pt-1.5">
        {QUALITY_PINS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={pin === option}
            className={BAR_BUTTON_CLASS}
            onClick={() => pinQuality(option)}
          >
            {PIN_LABEL[option]}
          </button>
        ))}
      </div>
    </Plate>
  )
}
