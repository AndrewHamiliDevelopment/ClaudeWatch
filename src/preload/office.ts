import { contextBridge, ipcRenderer } from 'electron'
import type { FeedMessage } from '../shared/office/types'

const officeBridge = {
  // Main replies by sending a hello with the current snapshot on 'office:feed'.
  ready: (): Promise<void> => ipcRenderer.invoke('office:ready'),

  onFeedMessage: (listener: (message: FeedMessage) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, message: FeedMessage): void =>
      listener(message)
    ipcRenderer.on('office:feed', handler)
    return () => {
      ipcRenderer.removeListener('office:feed', handler)
    }
  },

  jump: (sessionKey: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke('office:jump', sessionKey)
}

export type OfficeBridgeApi = typeof officeBridge

contextBridge.exposeInMainWorld('officeBridge', officeBridge)
