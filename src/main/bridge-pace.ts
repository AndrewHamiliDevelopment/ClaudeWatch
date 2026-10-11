import { BACKGROUND_POLL_MS, LIVE_POLL_MS } from '../shared/office/pace'

interface WatchedWindow {
  isDestroyed(): boolean
  isVisible(): boolean
  isMinimized(): boolean
  on(event: 'show' | 'hide' | 'minimize' | 'restore' | 'closed', listener: () => void): unknown
}

interface WindowSource {
  on(
    event: 'browser-window-created',
    listener: (event: unknown, window: WatchedWindow) => void
  ): unknown
}

const WINDOW_CHANGES = ['show', 'hide', 'minimize', 'restore', 'closed'] as const

// Every window (dashboard, tray popover, Office) draws the bridge's data, so the bridge polls
// live while any of them is on screen and slowly while none is. Notifications are not
// affected: they come from the session tracker, never from the bridge.
export function paceBridgeByWindows(
  app: WindowSource,
  windows: () => WatchedWindow[],
  setPollInterval: (intervalMs: number) => void
): void {
  const update = (): void => {
    const isWatched = windows().some(
      (window) => !window.isDestroyed() && window.isVisible() && !window.isMinimized()
    )
    setPollInterval(isWatched ? LIVE_POLL_MS : BACKGROUND_POLL_MS)
  }
  app.on('browser-window-created', (_event, window) => {
    for (const change of WINDOW_CHANGES) window.on(change, update)
  })
  update()
}
