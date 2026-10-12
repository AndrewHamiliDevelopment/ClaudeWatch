// Heaviest first: stepping down moves right, stepping up moves left.
export const QUALITY_LEVELS = ['full', 'balanced', 'light'] as const
export type QualityLevel = (typeof QUALITY_LEVELS)[number]

export const QUALITY_PINS = ['auto', ...QUALITY_LEVELS] as const
// What the owner asked for: a level, or `auto` to let the Office choose.
export type QualityPin = (typeof QUALITY_PINS)[number]

export interface QualitySettings {
  // Frames a second while every agent is seated and the camera is still.
  idleFps: number
  // Frames a second while an agent or the owner's character walks.
  walkFps: number
  maxPixelRatio: number
  // The share (0 to 1) of the outer ring of buildings that is drawn.
  ringShare: number
  // The share of lots that may carry an ambient mover; at 0 the ambient layer is not mounted.
  ambientShare: number
  // The share of citizens on the streets.
  citizenShare: number
}

export const QUALITY_SETTINGS: Record<QualityLevel, QualitySettings> = {
  full: {
    idleFps: 20,
    walkFps: 30,
    maxPixelRatio: 1.5,
    ringShare: 1,
    ambientShare: 1,
    citizenShare: 1
  },
  balanced: {
    idleFps: 15,
    walkFps: 30,
    maxPixelRatio: 1.25,
    ringShare: 0.6,
    ambientShare: 0.5,
    citizenShare: 0.5
  },
  light: {
    idleFps: 10,
    walkFps: 20,
    maxPixelRatio: 1,
    ringShare: 0.3,
    ambientShare: 0,
    citizenShare: 0.2
  }
}

function isLevel(value: string): value is QualityLevel {
  return QUALITY_LEVELS.some((level) => level === value)
}

export function parsePin(stored: string | null): QualityPin {
  return stored !== null && isLevel(stored) ? stored : 'auto'
}

export function levelInUse(pin: QualityPin, chosen: QualityLevel): QualityLevel {
  return pin === 'auto' ? chosen : pin
}

// What a machine says about itself before a frame is drawn. Browsers leave some of it out.
export interface MachineHints {
  cores?: number
  memoryGb?: number
  // The unmasked WebGL renderer string.
  renderer?: string
  pixelRatio: number
}

const SOFTWARE_RENDERER = /swiftshader|llvmpipe|softpipe|software|basic render/i
const INTEL_GRAPHICS = /intel/i
const LIGHT_MACHINE = { cores: 2, memoryGb: 2 }
const BALANCED_MACHINE = { cores: 4, memoryGb: 4 }
const DENSE_PIXEL_RATIO = 2

// A first guess with no benchmark; the frames that follow correct it.
export function levelForMachine(hints: MachineHints): QualityLevel {
  const { cores = Infinity, memoryGb = Infinity, renderer = '' } = hints
  if (SOFTWARE_RENDERER.test(renderer)) return 'light'
  if (cores <= LIGHT_MACHINE.cores || memoryGb <= LIGHT_MACHINE.memoryGb) return 'light'
  if (cores <= BALANCED_MACHINE.cores || memoryGb <= BALANCED_MACHINE.memoryGb) return 'balanced'
  const isDense = hints.pixelRatio >= DENSE_PIXEL_RATIO
  if (isDense && INTEL_GRAPHICS.test(renderer)) return 'balanced'
  return 'full'
}

// One drawn frame: how long after the previous one it came, and the rate that was asked for.
export interface FrameSample {
  timeMs: number
  intervalMs: number
  targetFps: number
}

export interface QualityWatch {
  level: QualityLevel
  enteredMs: number
  lastSampleMs: number
  // A leaky bucket of late-frame time: late frames fill it, on-time frames drain it.
  slowMs: number
  quietMs: number
  // How long a quiet spell must last before the next step up.
  quietNeededMs: number
  // Whether this level was reached by stepping up; failing here is what lengthens the wait.
  isTrial: boolean
}

// A frame this much later than asked is late. Wide enough for a 75 Hz display, where 30 a
// second lands every 40 ms, and narrow enough to catch one missed frame at 60 Hz.
const LATE_RATIO = 1.35
const STEP_DOWN_AFTER_MS = 3_000
const MIN_TIME_AT_LEVEL_MS = 5_000
// This much late time is a slow stretch and not a hitch: the quiet spell starts over.
const QUIET_BROKEN_AFTER_MS = 1_000
const QUIET_SPELL_MS = 60_000
const MAX_QUIET_SPELL_MS = 16 * 60_000
// A longer gap is a pause (the page was hidden, the machine slept), not a slow frame.
const PAUSE_MS = 2_000

export function startWatch(level: QualityLevel, timeMs: number): QualityWatch {
  return {
    level,
    enteredMs: timeMs,
    lastSampleMs: timeMs,
    slowMs: 0,
    quietMs: 0,
    quietNeededMs: QUIET_SPELL_MS,
    isTrial: false
  }
}

function moveTo(watch: QualityWatch, level: QualityLevel, timeMs: number): QualityWatch {
  const isStepUp = QUALITY_LEVELS.indexOf(level) < QUALITY_LEVELS.indexOf(watch.level)
  const hasFailedTrial = !isStepUp && watch.isTrial
  return {
    ...startWatch(level, timeMs),
    quietNeededMs: hasFailedTrial
      ? Math.min(MAX_QUIET_SPELL_MS, watch.quietNeededMs * 2)
      : watch.quietNeededMs,
    isTrial: isStepUp
  }
}

// Steps down when the page cannot hold its frame rate, and up after a long quiet spell.
export function watchFrame(watch: QualityWatch, sample: FrameSample): QualityWatch {
  const { timeMs, intervalMs, targetFps } = sample
  if (targetFps <= 0 || intervalMs <= 0 || intervalMs > PAUSE_MS)
    return { ...watch, lastSampleMs: timeMs }
  const isLate = intervalMs > (1000 / targetFps) * LATE_RATIO
  const slowMs = isLate ? watch.slowMs + intervalMs : Math.max(0, watch.slowMs - intervalMs)
  const isQuietBroken = isLate && slowMs >= QUIET_BROKEN_AFTER_MS
  const quietMs = isQuietBroken ? 0 : isLate ? watch.quietMs : watch.quietMs + intervalMs
  const index = QUALITY_LEVELS.indexOf(watch.level)
  const hasSettled = timeMs - watch.enteredMs >= MIN_TIME_AT_LEVEL_MS
  const lighter = QUALITY_LEVELS.at(index + 1)
  if (lighter && hasSettled && slowMs >= STEP_DOWN_AFTER_MS) return moveTo(watch, lighter, timeMs)
  const heavier = index > 0 ? QUALITY_LEVELS[index - 1] : undefined
  if (heavier && hasSettled && quietMs >= watch.quietNeededMs) return moveTo(watch, heavier, timeMs)
  return { ...watch, lastSampleMs: timeMs, slowMs, quietMs }
}
