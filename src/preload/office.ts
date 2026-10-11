import { contextBridge, ipcRenderer } from 'electron'
import type {
  FeedMessage,
  InteractionResult,
  PeekResult,
  PermissionDecision,
  ProviderId
} from '../shared/office/types'

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
    ipcRenderer.invoke('office:jump', sessionKey),

  send: (sessionKey: string, text: string): Promise<InteractionResult> =>
    ipcRenderer.invoke('office:send', sessionKey, text),

  respond: (
    sessionKey: string,
    decision: PermissionDecision,
    fingerprint: string
  ): Promise<InteractionResult> =>
    ipcRenderer.invoke('office:respond', sessionKey, decision, fingerprint),

  peek: (sessionKey: string): Promise<PeekResult> => ipcRenderer.invoke('office:peek', sessionKey),

  start: (projectKey: string, provider: ProviderId): Promise<InteractionResult> =>
    ipcRenderer.invoke('office:start', projectKey, provider)
}

export type OfficeBridgeApi = typeof officeBridge

contextBridge.exposeInMainWorld('officeBridge', officeBridge)
