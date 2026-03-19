interface ElectronAPI {
  getInstances: () => Promise<import('./lib/types').InstanceUpdate>
  getSettings: () => Promise<import('./lib/types').AppSettings>
  setSettings: (
    settings: Partial<import('./lib/types').AppSettings>
  ) => Promise<import('./lib/types').AppSettings>
  getHistory: () => Promise<import('./lib/types').SessionHistoryEntry[]>
  clearHistory: () => Promise<void>
  openDashboard: () => Promise<void>
  quit: () => Promise<void>
  openTerminal: (path: string, terminalType?: string) => Promise<{ success: boolean }>
  onInstancesUpdate: (callback: (data: import('./lib/types').InstanceUpdate) => void) => () => void
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
  onUpdaterStatus: (
    callback: (payload: import('./lib/types').UpdaterStatusPayload) => void
  ) => () => void
  getUsage: () => Promise<import('./lib/types').UsageStats | null>
  refreshUsage: () => Promise<import('./lib/types').UsageStats | null>
  onUsageUpdate: (callback: (data: import('./lib/types').UsageStats) => void) => () => void
  getPromoStatus: () => Promise<import('./lib/types').PromoStatus | null>
  onPromoUpdate: (callback: (data: import('./lib/types').PromoStatus) => void) => () => void
}

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
