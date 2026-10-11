import { clamp } from '../shared/range'

export interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

type Size = Pick<Bounds, 'width' | 'height'>

function isBounds(value: unknown): value is Bounds {
  if (typeof value !== 'object' || value === null) return false
  const rect = value as Record<string, unknown>
  return (
    ['x', 'y', 'width', 'height'].every((key) => Number.isFinite(rect[key])) &&
    (rect.width as number) > 0 &&
    (rect.height as number) > 0
  )
}

export function isOnAnyDisplay(rect: Bounds, workAreas: readonly Bounds[]): boolean {
  return workAreas.some(
    (area) =>
      rect.x < area.x + area.width &&
      rect.x + rect.width > area.x &&
      rect.y < area.y + area.height &&
      rect.y + rect.height > area.y
  )
}

// Reuses saved bounds only on a display that is still connected, and keeps the whole window,
// at no less than its minimum size, inside that display's work area.
export function restoreBounds(
  saved: unknown,
  workAreas: readonly Bounds[],
  fallback: Size,
  minimum: Size = { width: 0, height: 0 }
): Bounds | Size {
  if (!isBounds(saved)) return fallback
  // The display under the window's centre is its home. A window that mostly sat on a display
  // that is gone opens at the default instead of being squeezed onto what is left.
  const centre = { x: saved.x + saved.width / 2, y: saved.y + saved.height / 2 }
  const home = workAreas.find(
    (area) =>
      centre.x >= area.x &&
      centre.x < area.x + area.width &&
      centre.y >= area.y &&
      centre.y < area.y + area.height
  )
  if (!home) return fallback
  const width = Math.round(clamp(saved.width, [minimum.width, home.width]))
  const height = Math.round(clamp(saved.height, [minimum.height, home.height]))
  return {
    x: Math.round(clamp(saved.x, [home.x, home.x + home.width - width])),
    y: Math.round(clamp(saved.y, [home.y, home.y + home.height - height])),
    width,
    height
  }
}

interface MovableWindow {
  on(event: 'moved' | 'resized' | 'close', listener: () => void): unknown
  getNormalBounds(): Bounds
  isDestroyed(): boolean
}

const SAVE_DELAY_MS = 300

// Saves only what the user did. A window that opened at the default because its display was
// unplugged, and was never moved, must not overwrite the place it is remembered at.
export function rememberBounds(window: MovableWindow, save: (bounds: Bounds) => void): void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = (): void => {
    if (!timer) return
    clearTimeout(timer)
    timer = null
    // Normal bounds, so a maximised or full-screen window still reopens at its own size.
    if (!window.isDestroyed()) save(window.getNormalBounds())
  }
  const touched = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, SAVE_DELAY_MS)
  }
  window.on('moved', touched)
  window.on('resized', touched)
  window.on('close', flush)
}
