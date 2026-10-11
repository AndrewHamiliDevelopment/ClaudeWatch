import type { SessionTracker } from './session-tracker'
import type { UsageStatsReader } from './usage-stats'
import type { PromoChecker } from './promo-checker'
import type { RateLimitReader } from './rate-limit-reader'
import type { WidgetStatsWriter } from './widget-stats-writer'
import type { UsageStats, RateLimits } from '../renderer/lib/types'

interface SetupWidgetSyncOptions {
  tracker: Pick<SessionTracker, 'getInstances' | 'getStats'> & {
    on(event: 'update', listener: () => void): unknown
  }
  usageReader: Pick<UsageStatsReader, 'getLastData' | 'onUpdate'>
  promoChecker: Pick<PromoChecker, 'getLastData'>
  rateLimitReader: Pick<RateLimitReader, 'getLastData' | 'onUpdate'>
  writer: Pick<WidgetStatsWriter, 'write'>
}

export function setupWidgetSync({
  tracker,
  usageReader,
  promoChecker,
  rateLimitReader,
  writer
}: SetupWidgetSyncOptions): void {
  const writeSnapshot = (
    usageOverride?: UsageStats | null,
    rateLimitsOverride?: RateLimits | null
  ): void => {
    writer
      .write(
        tracker.getInstances(),
        tracker.getStats(),
        usageOverride ?? usageReader.getLastData(),
        promoChecker.getLastData(),
        rateLimitsOverride ?? rateLimitReader.getLastData()
      )
      .catch(() => {
        // Silently ignore widget write errors — widget is optional
      })
  }

  tracker.on('update', () => {
    writeSnapshot()
  })

  usageReader.onUpdate((usage) => {
    writeSnapshot(usage)
  })

  rateLimitReader.onUpdate((rateLimits) => {
    writeSnapshot(undefined, rateLimits)
  })
}
