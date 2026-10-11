export type WheelIntent = 'pinch' | 'wheel-zoom' | 'scroll-pan'

export interface WheelInput {
  deltaX: number
  deltaY: number
  // 0 pixels, 1 lines, 2 pages (WheelEvent.deltaMode).
  deltaMode: number
  // Legacy wheelDeltaY; a notched mouse reports whole multiples of 120. Null where absent.
  wheelDeltaY: number | null
  // Ctrl (how a trackpad pinch arrives) or Cmd.
  hasZoomModifier: boolean
  timeMs: number
}

const NOTCH_WHEEL_DELTA = 120
const GESTURE_GAP_MS = 150
const PINCH_GAIN = 0.01
// One notch is one step (×1.2), whatever delta it carries: the delta varies by browser and by
// how fast the wheel turns, from about 4 px to several hundred.
const NOTCH_STEP = 0.18
// A mouse wheel with Ctrl or Cmd held arrives as a pinch; capped here it zooms like a plain notch.
const MAX_PINCH_PX = NOTCH_STEP / PINCH_GAIN

function isNotched(input: WheelInput): boolean {
  if (input.deltaMode !== 0) return true
  const { wheelDeltaY } = input
  return (
    wheelDeltaY !== null &&
    wheelDeltaY !== 0 &&
    wheelDeltaY % NOTCH_WHEEL_DELTA === 0 &&
    input.deltaX === 0
  )
}

// A trackpad swipe passes through deltas that look like a notch (40 px is wheelDelta 120), so the
// first event of a gesture decides and the rest of the swipe keeps that reading.
export function createWheelClassifier(): (input: WheelInput) => WheelIntent {
  let gesture: WheelIntent = 'scroll-pan'
  let lastScrollMs = -Infinity
  return (input) => {
    if (input.hasZoomModifier) return 'pinch'
    if (input.timeMs - lastScrollMs > GESTURE_GAP_MS)
      gesture = isNotched(input) ? 'wheel-zoom' : 'scroll-pan'
    lastScrollMs = input.timeMs
    return gesture
  }
}

// Multiplier for the zoom goal. Exponential, so zooming in then out by the same input is exact.
export function zoomFactor(intent: WheelIntent, input: WheelInput): number {
  if (intent === 'scroll-pan') return 1
  if (intent === 'wheel-zoom') return Math.exp(-Math.sign(input.deltaY) * NOTCH_STEP)
  const pixels = Math.max(-MAX_PINCH_PX, Math.min(MAX_PINCH_PX, input.deltaY))
  return Math.exp(-pixels * PINCH_GAIN)
}

export function nextZoomGoal(
  goal: number,
  factor: number,
  limits: { min: number; max: number }
): number {
  return Math.max(limits.min, Math.min(limits.max, goal * factor))
}

export function wheelInputFrom(event: WheelEvent, timeMs: number): WheelInput {
  const legacy = 'wheelDeltaY' in event ? event.wheelDeltaY : null
  return {
    deltaX: event.deltaX,
    deltaY: event.deltaY,
    deltaMode: event.deltaMode,
    wheelDeltaY: typeof legacy === 'number' ? legacy : null,
    hasZoomModifier: event.ctrlKey || event.metaKey,
    timeMs
  }
}
