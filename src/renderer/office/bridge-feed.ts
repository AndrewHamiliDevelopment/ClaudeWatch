import type { OfficeFeed, OfficeFrame } from './scene-model'

// Shape of `window.office`, provided by the Office window preload in Phase 6.
export interface OfficeBridge {
  onFeed(callback: (frame: OfficeFrame) => void): () => void
  jump(sessionKey: string): void
}

export function createBridgeFeed(bridge: OfficeBridge): OfficeFeed {
  return {
    subscribe: (listener) => bridge.onFeed(listener),
    jump: (sessionKey) => bridge.jump(sessionKey)
  }
}
