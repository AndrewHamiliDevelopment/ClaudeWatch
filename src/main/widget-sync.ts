import type { SessionTracker } from './session-tracker'
import type { UsageStatsReader } from './usage-stats'
import type { PromoChecker } from './promo-checker'
import type { WidgetStatsWriter } from './widget-stats-writer'
import type { UsageStats } from '../renderer/lib/types'

interface SetupWidgetSyncOptions {
  tracker: SessionTracker
  usageReader: UsageStatsReader
  promoChecker: PromoChecker
  writer: WidgetStatsWriter
}

export function setupWidgetSync({
  tracker,
  usageReader,
  promoChecker,
  writer
}: SetupWidgetSyncOptions): void {
  const writeSnapshot = (usageOverride?: UsageStats | null): void => {
    writer
      .write(
        tracker.getInstances(),
        tracker.getStats(),
        usageOverride ?? usageReader.getLastData(),
        promoChecker.getLastData()
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
}
