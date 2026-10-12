export interface PointerSample {
  timeMs: number
  x: number
  y: number
}

// Screen pixels per second.
export interface Fling {
  vx: number
  vy: number
}

const VELOCITY_WINDOW_MS = 100
// A hand that paused this long before letting go meant to stop, not to throw.
const HELD_STILL_MS = 60
const MIN_FLING_SPEED = 300
const MAX_FLING_SPEED = 3000
const DECAY_TAU_SEC = 0.25
// Under one pixel per frame at 60 Hz: the coast ends here instead of creeping.
const STOP_SPEED = 50
const AT_REST: Fling = { vx: 0, vy: 0 }

export function releaseVelocity(samples: readonly PointerSample[], releaseMs: number): Fling {
  const newest = samples.at(-1)
  if (!newest || releaseMs - newest.timeMs > HELD_STILL_MS) return AT_REST
  const oldest = samples.find((sample) => newest.timeMs - sample.timeMs <= VELOCITY_WINDOW_MS)
  if (!oldest || newest.timeMs === oldest.timeMs) return AT_REST
  const seconds = (newest.timeMs - oldest.timeMs) / 1000
  return { vx: (newest.x - oldest.x) / seconds, vy: (newest.y - oldest.y) / seconds }
}

export function startFling(velocity: Fling): Fling | null {
  const speed = Math.hypot(velocity.vx, velocity.vy)
  if (speed < MIN_FLING_SPEED) return null
  const scale = Math.min(speed, MAX_FLING_SPEED) / speed
  return { vx: velocity.vx * scale, vy: velocity.vy * scale }
}

// Exact integral of the exponential decay over the frame, so the travel does not depend on
// the frame rate.
export function stepFling(
  fling: Fling,
  deltaSec: number
): { dx: number; dy: number; fling: Fling | null } {
  const decay = Math.exp(-deltaSec / DECAY_TAU_SEC)
  const reach = DECAY_TAU_SEC * (1 - decay)
  const next = { vx: fling.vx * decay, vy: fling.vy * decay }
  return {
    dx: fling.vx * reach,
    dy: fling.vy * reach,
    fling: Math.hypot(next.vx, next.vy) < STOP_SPEED ? null : next
  }
}
