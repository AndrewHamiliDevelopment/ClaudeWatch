import Store from 'electron-store'
import type { AppSettings, SessionHistoryEntry } from '../renderer/lib/types'
import { DEFAULT_SETTINGS } from '../renderer/lib/types'
import type { Bounds } from './window-bounds'

interface StoreSchema {
  settings: AppSettings
  history: SessionHistoryEntry[]
  popoverPinned: boolean
  popoverPosition: { x: number; y: number } | null
  officeWindowBounds: Bounds | null
}

function defined<T extends object>(value: T | null | undefined): Partial<T> {
  if (typeof value !== 'object' || value === null) return {}
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry != null)
  ) as Partial<T>
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
        officeWindowBounds: null
      }
    })
  }

  getSettings(): AppSettings {
    const saved = this.store.get('settings', DEFAULT_SETTINGS)
    // Defaults fill whatever an older version never saved, or a damaged file lost.
    const stored: AppSettings = {
      ...DEFAULT_SETTINGS,
      ...defined(saved),
      notifications: { ...DEFAULT_SETTINGS.notifications, ...defined(saved?.notifications) }
    }
    // Migrate cpuIdleThreshold from old default (1.0) to new default (3.0)
    if (stored.cpuIdleThreshold === 1.0) {
      stored.cpuIdleThreshold = DEFAULT_SETTINGS.cpuIdleThreshold
      this.store.set('settings', stored)
    }
    return stored
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
