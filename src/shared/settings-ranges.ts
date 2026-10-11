import type { AppSettings } from '../renderer/lib/types'
import type { Range } from './range'

type NumericSetting = {
  [Key in keyof AppSettings]: AppSettings[Key] extends number ? Key : never
}[keyof AppSettings]

// Inclusive range of every numeric setting: a new one does not compile until it has a range.
export const SETTING_RANGES: Record<NumericSetting, Range> = {
  pollingIntervalMs: [500, 60_000],
  cpuIdleThreshold: [0.1, 100],
  maxHistoryEntries: [1, 10_000],
  weeklyTokenTarget: [100_000, 100_000_000],
  staleThresholdMinutes: [5, 120]
}
export const COOLDOWN_SECONDS_RANGE: Range = [10, 120]
