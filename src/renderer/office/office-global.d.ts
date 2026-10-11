import type { OfficeBridgeApi } from '../../preload/office'

declare global {
  interface Window {
    // Present in the Office window (its preload); absent in the browser preview.
    officeBridge?: OfficeBridgeApi
  }
}

export {}
