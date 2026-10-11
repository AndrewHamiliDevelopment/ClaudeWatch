const ZOOM_TAU_SEC = 0.08
// Closer than this in log space (0.02 %) the zoom lands on the goal instead of creeping.
const SETTLE_LOG = 2e-4

// One frame of zoom toward the goal, eased in log space so every octave takes the same time.
export function easeZoom(
  current: number,
  goal: number,
  deltaSec: number,
  isInstant: boolean
): number {
  const remaining = Math.log(goal / current)
  if (isInstant || Math.abs(remaining) < SETTLE_LOG) return goal
  const next = current * Math.exp(remaining * (1 - Math.exp(-deltaSec / ZOOM_TAU_SEC)))
  return Math.abs(Math.log(goal / next)) < SETTLE_LOG ? goal : next
}

// How far to truck the camera (metres along screen-right and screen-down, the camera-controls
// convention) so the world point under the cursor stays on its pixel while the zoom changes.
// `cursorOffset` is the cursor in pixels from the viewport centre, y down.
export function anchorTruck(
  cursorOffset: { x: number; y: number },
  zoom: number,
  next: number
): { x: number; y: number } {
  const shift = 1 / zoom - 1 / next
  // `|| 0` turns the -0 of a zero shift into 0.
  return { x: cursorOffset.x * shift || 0, y: cursorOffset.y * shift || 0 }
}
