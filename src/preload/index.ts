import { contextBridge, ipcRenderer } from 'electron'
import type {
  AppSettings,
  InstanceUpdate,
  SessionHistoryEntry,
  UpdaterStatusPayload,
  UsageStats,
  PromoStatus
} from '../renderer/lib/types'

const api = {
  getInstances: (): Promise<InstanceUpdate> => ipcRenderer.invoke('instances:get'),

  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),

  setSettings: (settings: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', settings),

  getHistory: (): Promise<SessionHistoryEntry[]> => ipcRenderer.invoke('history:get'),

  clearHistory: (): Promise<{ success: boolean }> => ipcRenderer.invoke('history:clear'),

  openDashboard: (): Promise<{ success: boolean }> => ipcRenderer.invoke('app:open-dashboard'),

  quit: (): Promise<void> => ipcRenderer.invoke('app:quit'),

  openTerminal: (path: string, terminalType?: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('terminal:open', path, terminalType),

  onInstancesUpdate: (callback: (data: InstanceUpdate) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: InstanceUpdate): void =>
      callback(data)
    ipcRenderer.on('instances:update', handler)
    return () => {
      ipcRenderer.removeListener('instances:update', handler)
    }
  },

  checkForUpdates: (): Promise<void> => ipcRenderer.invoke('updater:check'),

  downloadUpdate: (): Promise<void> => ipcRenderer.invoke('updater:download'),

  installUpdate: (): Promise<void> => ipcRenderer.invoke('updater:install'),

  onUpdaterStatus: (callback: (payload: UpdaterStatusPayload) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, payload: UpdaterStatusPayload): void =>
      callback(payload)
    ipcRenderer.on('updater:status', handler)
    return () => {
      ipcRenderer.removeListener('updater:status', handler)
    }
  },

  getUsage: (): Promise<UsageStats | null> => ipcRenderer.invoke('usage:get'),

  refreshUsage: (): Promise<UsageStats | null> => ipcRenderer.invoke('usage:refresh'),

  onUsageUpdate: (callback: (data: UsageStats) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: UsageStats): void => callback(data)
    ipcRenderer.on('usage:update', handler)
    return () => {
      ipcRenderer.removeListener('usage:update', handler)
    }
  },

  getPromoStatus: (): Promise<PromoStatus | null> => ipcRenderer.invoke('promo:get'),

  onPromoUpdate: (callback: (data: PromoStatus) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: PromoStatus): void => callback(data)
    ipcRenderer.on('promo:update', handler)
    return () => {
      ipcRenderer.removeListener('promo:update', handler)
    }
  }
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('api', api)
