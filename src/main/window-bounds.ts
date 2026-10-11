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

function overlapArea(a: Bounds, b: Bounds): number {
  const width = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)
  const height = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)
  return width > 0 && height > 0 ? width * height : 0
}

// Reuses saved bounds only on a display that is still connected (an unplugged monitor would
// leave the window off screen) and keeps the whole window inside that display's work area.
export function restoreBounds(
  saved: unknown,
  workAreas: readonly Bounds[],
  fallback: Size
): Bounds | Size {
  if (!isBounds(saved)) return fallback
  const home = workAreas.reduce<Bounds | null>(
    (best, area) =>
      overlapArea(saved, area) > (best ? overlapArea(saved, best) : 0) ? area : best,
    null
  )
  if (!home) return fallback
  const width = Math.min(saved.width, home.width)
  const height = Math.min(saved.height, home.height)
  return {
    x: Math.min(Math.max(saved.x, home.x), home.x + home.width - width),
    y: Math.min(Math.max(saved.y, home.y), home.y + home.height - height),
    width,
    height
  }
}
