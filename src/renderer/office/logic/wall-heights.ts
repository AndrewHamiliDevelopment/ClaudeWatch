import { approach } from './character-pose'
import { wallHeight, type WallSegment, type WallsMode } from './room-layout'

const LOWER_RATE = 10
const SETTLED_EPSILON = 0.001

export interface WallHeights {
  heights: number[]
  // Eases every wall toward its target in place; false means nothing moved, so the caller
  // can skip rebuilding its instance matrices this frame.
  step(
    segments: readonly WallSegment[],
    mode: WallsMode,
    camera: { x: number; z: number },
    deltaSec: number,
    isReducedMotion: boolean
  ): boolean
}

// `initialHeight` is where a wall starts before its first frame; omitted, it starts at its target.
export function createWallHeights(initialHeight?: number): WallHeights {
  const heights: number[] = []
  let lastSegments: readonly WallSegment[] | null = null
  return {
    heights,
    step(segments, mode, camera, deltaSec, isReducedMotion) {
      let hasChanged = segments !== lastSegments
      lastSegments = segments
      heights.length = segments.length
      for (let index = 0; index < segments.length; index += 1) {
        const target = wallHeight(mode, segments[index], camera)
        const current = heights[index] ?? initialHeight ?? target
        const eased = isReducedMotion ? target : approach(current, target, deltaSec, LOWER_RATE)
        const next = Math.abs(eased - target) < SETTLED_EPSILON ? target : eased
        if (next !== heights[index]) hasChanged = true
        heights[index] = next
      }
      return hasChanged
    }
  }
}
