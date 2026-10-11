// Written by the scene every frame, read by the DOM overlay on its own slow timer,
// so per-frame numbers never go through React state.
export interface FrameMetrics {
  fps: number
  frameMs: number
  drawCalls: number
  triangles: number
}

export function createFrameMetrics(): FrameMetrics {
  return { fps: 0, frameMs: 0, drawCalls: 0, triangles: 0 }
}
