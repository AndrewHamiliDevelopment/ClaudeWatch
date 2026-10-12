// Stands in for @react-three/fiber in a test: keeps each frame callback so the test can run it.
export interface FrameState {
  clock: { elapsedTime: number }
  invalidate: () => void
}
type FrameCallback = (state: FrameState, delta: number) => void

export const frameCallbacks: FrameCallback[] = []

export function useFrame(callback: FrameCallback): void {
  frameCallbacks.push(callback)
}
