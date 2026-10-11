// The preload's `api` object is the single source of truth for the renderer bridge type.
type ElectronAPI = import('../preload/index').ElectronAPI

declare global {
  interface Window {
    api: ElectronAPI
  }
}

export {}
