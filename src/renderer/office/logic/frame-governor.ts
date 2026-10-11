export interface PageVisibility {
  isHidden: boolean
  isFocused: boolean
}

export interface VisibilityEnv {
  read(): PageVisibility
  onChange(callback: () => void): () => void
}

// The display's frame clock, injected so the governor can be driven by hand in tests.
export interface FrameEnv extends VisibilityEnv {
  requestFrame(callback: (timeMs: number) => void): number
  cancelFrame(handle: number): void
  now(): number
}

export interface FrameGovernor {
  // Input arrived or the camera moved: render every display frame for a short while.
  boost(): void
  isBoosted(): boolean
  stop(): void
}

const FOCUSED_FPS = 30
const BLURRED_FPS = 10
const BOOST_HOLD_MS = 400
// Half a 120 Hz frame: a display frame this close to due counts as due, so 30 fps is exactly
// every second frame at 60 Hz instead of drifting between two and three.
const DUE_TOLERANCE_MS = 4

export function targetFps(visibility: PageVisibility): number {
  if (visibility.isHidden) return 0
  return visibility.isFocused ? FOCUSED_FPS : BLURRED_FPS
}

export function browserFrameEnv(): FrameEnv {
  return {
    read: () => ({ isHidden: document.hidden, isFocused: document.hasFocus() }),
    onChange: (callback) => {
      document.addEventListener('visibilitychange', callback)
      window.addEventListener('focus', callback)
      window.addEventListener('blur', callback)
      return () => {
        document.removeEventListener('visibilitychange', callback)
        window.removeEventListener('focus', callback)
        window.removeEventListener('blur', callback)
      }
    },
    requestFrame: (callback) => requestAnimationFrame(callback),
    cancelFrame: (handle) => cancelAnimationFrame(handle),
    now: () => performance.now()
  }
}

// Drives a frameloop="demand" canvas from the display's own frames: the idle rate is counted on
// them rather than on a timer (which drifts against vsync), and it sleeps entirely while hidden.
export function startFrameGovernor(invalidate: () => void, env: FrameEnv): FrameGovernor {
  let handle: number | null = null
  let lastInvalidateMs = -Infinity
  let boostUntilMs = -Infinity

  const onDisplayFrame = (timeMs: number): void => {
    handle = null
    const fps = targetFps(env.read())
    if (fps === 0) return
    const isDue = timeMs - lastInvalidateMs >= 1000 / fps - DUE_TOLERANCE_MS
    if (timeMs < boostUntilMs || isDue) {
      lastInvalidateMs = timeMs
      invalidate()
    }
    handle = env.requestFrame(onDisplayFrame)
  }

  const wake = (): void => {
    if (handle === null && targetFps(env.read()) > 0) handle = env.requestFrame(onDisplayFrame)
  }

  const stopListening = env.onChange(wake)
  wake()

  return {
    boost: () => {
      boostUntilMs = env.now() + BOOST_HOLD_MS
    },
    isBoosted: () => env.now() < boostUntilMs && targetFps(env.read()) > 0,
    stop: () => {
      stopListening()
      if (handle !== null) env.cancelFrame(handle)
      handle = null
    }
  }
}
