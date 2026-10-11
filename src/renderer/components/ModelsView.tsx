import { RefreshCw } from 'lucide-react'
import { useUsage } from '../hooks/useUsage'
import type { UsageStats } from '../lib/types'
import { cn, formatCompactNumber, formatCurrency } from '../lib/utils'
import { BUTTON_QUIET_COMPACT_CLASS } from './deck/deck-styles'
import { Plate } from './deck/Plate'

export function ModelsView() {
  const { usage, loading, refresh } = useUsage()

  return (
    <div className="no-drag flex h-full min-h-0 flex-col gap-3 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <h1 className="pt-1 font-plate text-count">Models</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className={BUTTON_QUIET_COMPACT_CLASS}
        >
          <RefreshCw
            className={cn('size-3.5', loading && 'motion-safe:animate-spin')}
            aria-hidden="true"
          />
          Refresh
        </button>
      </div>
      {usage && <ModelUsage usage={usage} />}
    </div>
  )
}

function ModelUsage({ usage }: { usage: UsageStats }) {
  if (!usage.dataAvailable) {
    return (
      <p className="py-10 text-center text-body text-text-secondary" role="status">
        Claude Code usage data not found
      </p>
    )
  }

  const totals = [
    { label: 'Cost', value: formatCurrency(usage.totalCostUSD) },
    { label: 'Input', value: formatCompactNumber(usage.totalInputTokens) },
    { label: 'Output', value: formatCompactNumber(usage.totalOutputTokens) },
    { label: 'Cache read', value: formatCompactNumber(usage.totalCacheReadTokens) }
  ]

  return (
    <>
      <Plate>
        <dl className="grid grid-cols-4 gap-3 px-4 py-3" aria-label="Usage totals">
          {totals.map(({ label, value }) => (
            <div key={label} className="flex flex-col-reverse gap-1">
              <dt className="text-xs text-text-secondary">{label}</dt>
              <dd
                className={cn(
                  'pt-1 font-plate text-stat tabular-nums',
                  label !== 'Cost' && 'text-accent'
                )}
              >
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </Plate>

      {usage.modelUsage.length === 0 ? (
        <p className="py-10 text-center text-body text-text-secondary" role="status">
          No model has reported usage yet.
        </p>
      ) : (
        <table className="w-full text-body">
          <thead>
            <tr className="border-b border-border text-left text-caption text-text-tertiary">
              <th scope="col" className="px-2 py-1.5 font-normal">
                Model
              </th>
              {['Input', 'Output', 'Cache read', 'Cost'].map((column) => (
                <th key={column} scope="col" className="px-2 py-1.5 text-right font-normal">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {usage.modelUsage.map((model) => (
              <tr key={model.model} className="h-8 border-b border-border/40 tabular-nums">
                <th scope="row" className="px-2 text-left font-mono text-mono-sm">
                  {model.model}
                </th>
                <td className="px-2 text-right">{formatCompactNumber(model.inputTokens)}</td>
                <td className="px-2 text-right">{formatCompactNumber(model.outputTokens)}</td>
                <td className="px-2 text-right">
                  {formatCompactNumber(model.cacheReadInputTokens)}
                </td>
                <td className="px-2 text-right font-semibold">{formatCurrency(model.costUSD)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
