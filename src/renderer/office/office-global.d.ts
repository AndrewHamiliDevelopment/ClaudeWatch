import type { OfficeBridge } from './bridge-feed'

declare global {
  interface Window {
    // Present in the Office window (Phase 6 preload); absent in the browser preview.
    office?: OfficeBridge
  }
}

export {}
