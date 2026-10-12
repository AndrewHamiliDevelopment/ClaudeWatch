import { useEffect, useState } from 'react'
import { Plate } from '../../components/deck/Plate'
import type { FrameMetrics } from '../frame-metrics'
import { levelInUse } from '../logic/quality'
import { useQualityChoice } from '../quality-store'

const REFRESH_MS = 500

export function MetricsOverlay({ metrics }: { metrics: FrameMetrics }) {
  const [shown, setShown] = useState<FrameMetrics>(() => ({ ...metrics }))
  const { pin, chosen } = useQualityChoice()
  useEffect(() => {
    const timer = setInterval(() => setShown({ ...metrics }), REFRESH_MS)
    return () => clearInterval(timer)
  }, [metrics])

  // The level is shown here and changed in the settings panel.
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
        className="grid grid-cols-[auto_auto] gap-x-3 px-3 py-2 font-mono text-mono-sm"
      >
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-text-secondary">{term}</dt>
            <dd className="text-right tabular-nums text-text-primary">{value}</dd>
          </div>
        ))}
      </dl>
    </Plate>
  )
}
