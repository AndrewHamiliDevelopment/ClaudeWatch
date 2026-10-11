import Store from 'electron-store'
import type { AppSettings, SessionHistoryEntry } from '../renderer/lib/types'
import { DEFAULT_SETTINGS } from '../renderer/lib/types'
import type { Bounds } from './window-bounds'
import { conformSettings } from './settings-shape'

interface StoreSchema {
  settings: AppSettings
  history: SessionHistoryEntry[]
  popoverPinned: boolean
  popoverPosition: { x: number; y: number } | null
  officeWindowBounds: Bounds | null
  cpuIdleDefaultMigrated: boolean
}

export class SettingsStore {
  private store: Store<StoreSchema>

  constructor() {
    this.store = new Store<StoreSchema>({
      name: 'claudewatch',
      defaults: {
        settings: DEFAULT_SETTINGS,
        history: [],
        popoverPinned: false,
        popoverPosition: null,
        officeWindowBounds: null,
        cpuIdleDefaultMigrated: false
      }
    })
    this.migrateCpuIdleDefault()
  }

  // Once per install: 1.0 was the old default. Afterwards 1.0 is the owner's own choice.
  private migrateCpuIdleDefault(): void {
    if (this.store.get('cpuIdleDefaultMigrated', false)) return
    const settings = this.getSettings()
    if (settings.cpuIdleThreshold === 1.0) {
      this.store.set('settings', {
        ...settings,
        cpuIdleThreshold: DEFAULT_SETTINGS.cpuIdleThreshold
      })
    }
    this.store.set('cpuIdleDefaultMigrated', true)
  }

  getSettings(): AppSettings {
    const saved = this.store.get('settings', DEFAULT_SETTINGS)
    // Defaults fill whatever an older version never saved, or a damaged or hand-edited file
    // holds in the wrong type.
    const known = conformSettings(saved)
    return {
      ...DEFAULT_SETTINGS,
      ...known,
      notifications: { ...DEFAULT_SETTINGS.notifications, ...known.notifications }
    }
  }

  setSettings(partial: Partial<AppSettings>): AppSettings {
    const current = this.getSettings()
    const merged: AppSettings = {
      ...current,
      ...partial,
      notifications: { ...current.notifications, ...partial.notifications }
    }
    this.store.set('settings', merged)
    return merged
  }

  getHistory(): SessionHistoryEntry[] {
    return this.store.get('history', [])
  }

  addHistoryEntry(entry: SessionHistoryEntry): void {
    const history = this.getHistory()
    history.push(entry)
    const max = this.getSettings().maxHistoryEntries
    const trimmed = history.length > max ? history.slice(-max) : history
    this.store.set('history', trimmed)
  }

  clearHistory(): void {
    this.store.set('history', [])
  }

  getPopoverPinned(): boolean {
    return this.store.get('popoverPinned', false)
  }

  setPopoverPinned(pinned: boolean): void {
    this.store.set('popoverPinned', pinned)
  }

  getPopoverPosition(): { x: number; y: number } | null {
    return this.store.get('popoverPosition', null)
  }

  setPopoverPosition(position: { x: number; y: number } | null): void {
    this.store.set('popoverPosition', position)
  }

  getOfficeWindowBounds(): Bounds | null {
    return this.store.get('officeWindowBounds', null)
  }

  setOfficeWindowBounds(bounds: Bounds): void {
    this.store.set('officeWindowBounds', bounds)
  }
}
