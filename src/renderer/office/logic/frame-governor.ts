export interface PageVisibility {
  isHidden: boolean
  isFocused: boolean
}

export interface VisibilityEnv {
  read(): PageVisibility
  onChange(callback: () => void): () => void
}

const FOCUSED_FPS = 30
const BLURRED_FPS = 10

export function targetFps(visibility: PageVisibility): number {
  if (visibility.isHidden) return 0
  return visibility.isFocused ? FOCUSED_FPS : BLURRED_FPS
}

export function browserVisibilityEnv(): VisibilityEnv {
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
    }
  }
}

// Drives a frameloop="demand" canvas: invalidate at the target rate, sleep entirely while hidden.
export function startFrameGovernor(invalidate: () => void, env: VisibilityEnv): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null

  const tick = (): void => {
    timer = null
    const fps = targetFps(env.read())
    if (fps === 0) return
    invalidate()
    timer = setTimeout(tick, 1000 / fps)
  }

  const wake = (): void => {
    if (timer === null) tick()
  }

  const stopListening = env.onChange(wake)
  tick()

  return () => {
    stopListening()
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
}
