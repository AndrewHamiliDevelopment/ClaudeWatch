import { describe, expect, it } from 'vitest'
import {
  levelForMachine,
  levelInUse,
  parsePin,
  QUALITY_LEVELS,
  QUALITY_SETTINGS,
  startWatch,
  watchFrame,
  type QualityLevel,
  type QualityWatch
} from '../logic/quality'

const CAPABLE = { cores: 10, memoryGb: 8, renderer: 'ANGLE (Apple, Apple M2 Pro)', pixelRatio: 2 }

describe('QUALITY_SETTINGS', () => {
  it('never spends more at a lighter level', () => {
    const [full, balanced, light] = QUALITY_LEVELS.map((level) => QUALITY_SETTINGS[level])
    for (const [heavier, lighter] of [
      [full, balanced],
      [balanced, light]
    ]) {
      expect(lighter.idleFps).toBeLessThan(heavier.idleFps)
      expect(lighter.walkFps).toBeLessThanOrEqual(heavier.walkFps)
      expect(lighter.maxPixelRatio).toBeLessThan(heavier.maxPixelRatio)
      expect(lighter.ambientShare).toBeLessThan(heavier.ambientShare)
    }
  })

  it('draws the whole town at full, as before there were levels', () => {
    expect(QUALITY_SETTINGS.full).toMatchObject({
      walkFps: 30,
      maxPixelRatio: 1.5,
      ambientShare: 1
    })
  })

  it('keeps the ambient share between 0 and 1 and never idles faster than it walks', () => {
    for (const level of QUALITY_LEVELS) {
      const settings = QUALITY_SETTINGS[level]
      expect(settings.ambientShare).toBeGreaterThanOrEqual(0)
      expect(settings.ambientShare).toBeLessThanOrEqual(1)
      expect(settings.idleFps).toBeLessThanOrEqual(settings.walkFps)
    }
  })
})

describe('levelForMachine', () => {
  it('starts a capable machine at full', () => {
    expect(levelForMachine(CAPABLE)).toBe('full')
  })

  it('starts at full when the machine says nothing about itself', () => {
    expect(levelForMachine({ pixelRatio: 1 })).toBe('full')
  })

  it('starts software rendering at light, whatever else the machine has', () => {
    for (const renderer of [
      'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)), SwiftShader driver)',
      'llvmpipe (LLVM 15.0.7, 256 bits)',
      'Microsoft Basic Render Driver'
    ])
      expect(levelForMachine({ ...CAPABLE, renderer })).toBe('light')
  })

  it('starts a two-core or 2 GB machine at light', () => {
    expect(levelForMachine({ ...CAPABLE, cores: 2 })).toBe('light')
    expect(levelForMachine({ ...CAPABLE, memoryGb: 2 })).toBe('light')
  })

  it('starts a four-core or 4 GB machine at balanced', () => {
    expect(levelForMachine({ ...CAPABLE, cores: 4 })).toBe('balanced')
    expect(levelForMachine({ ...CAPABLE, memoryGb: 4 })).toBe('balanced')
  })

  it('starts integrated Intel graphics on a dense display at balanced', () => {
    const intel = { ...CAPABLE, renderer: 'ANGLE (Intel, Intel(R) Iris(TM) Plus Graphics 640)' }
    expect(levelForMachine(intel)).toBe('balanced')
    expect(levelForMachine({ ...intel, pixelRatio: 1 })).toBe('full')
  })
})

describe('parsePin and levelInUse', () => {
  it('reads a stored pin and falls back to auto for anything else', () => {
    expect(parsePin('light')).toBe('light')
    expect(parsePin('auto')).toBe('auto')
    expect(parsePin(null)).toBe('auto')
    expect(parsePin('ultra')).toBe('auto')
  })

  it('uses the pin when there is one, else the level the Office chose', () => {
    expect(levelInUse('auto', 'balanced')).toBe('balanced')
    expect(levelInUse('light', 'full')).toBe('light')
  })
})

describe('watchFrame', () => {
  const TARGET_FPS = 30
  const ON_TIME_MS = 1000 / TARGET_FPS

  // Feeds frames `intervalMs` apart for `durationMs`, recording every level change.
  function run(
    watch: QualityWatch,
    intervalMs: number,
    durationMs: number,
    changes: [number, QualityLevel][] = []
  ): QualityWatch {
    let current = watch
    const endMs = current.lastSampleMs + durationMs
    for (let timeMs = current.lastSampleMs + intervalMs; timeMs <= endMs; timeMs += intervalMs) {
      const next = watchFrame(current, { timeMs, intervalMs, targetFps: TARGET_FPS })
      if (next.level !== current.level) changes.push([timeMs, next.level])
      current = next
    }
    return current
  }

  it('holds its level while frames arrive on time', () => {
    expect(run(startWatch('full', 0), ON_TIME_MS, 30_000).level).toBe('full')
  })

  it('steps down within a few seconds when the page cannot hold its frame rate', () => {
    const changes: [number, QualityLevel][] = []
    run(startWatch('full', 0), 60, 8_000, changes)
    expect(changes[0][1]).toBe('balanced')
    expect(changes[0][0]).toBeLessThanOrEqual(6_000)
  })

  it('goes on down to light when balanced is still too slow, one level at a time', () => {
    const changes: [number, QualityLevel][] = []
    const watch = run(startWatch('full', 0), 60, 20_000, changes)
    expect(changes.map(([, level]) => level)).toEqual(['balanced', 'light'])
    expect(watch.level).toBe('light')
  })

  it('stays at a level for a minimum time, however slow the frames', () => {
    const changes: [number, QualityLevel][] = []
    run(startWatch('full', 0), 200, 20_000, changes)
    expect(changes[1][0] - changes[0][0]).toBeGreaterThanOrEqual(5_000)
  })

  it('ignores a short hitch', () => {
    let watch = run(startWatch('full', 0), ON_TIME_MS, 5_000)
    watch = run(watch, 120, 1_000)
    watch = run(watch, ON_TIME_MS, 5_000)
    expect(watch.level).toBe('full')
  })

  it('does not count the gap after the page was hidden as a slow frame', () => {
    let watch = run(startWatch('full', 0), ON_TIME_MS, 5_000)
    watch = watchFrame(watch, { timeMs: 65_000, intervalMs: 60_000, targetFps: TARGET_FPS })
    watch = run(watch, ON_TIME_MS, 5_000)
    expect(watch.level).toBe('full')
  })

  it('steps back up only after a long quiet spell', () => {
    const changes: [number, QualityLevel][] = []
    let watch = run(startWatch('full', 0), 60, 8_000, changes)
    expect(watch.level).toBe('balanced')
    watch = run(watch, ON_TIME_MS, 50_000, changes)
    expect(watch.level).toBe('balanced')
    watch = run(watch, ON_TIME_MS, 20_000, changes)
    expect(watch.level).toBe('full')
  })

  it('starts the quiet spell over when a slow stretch interrupts it', () => {
    let watch = run(startWatch('balanced', 0), ON_TIME_MS, 50_000)
    watch = run(watch, 60, 1_500)
    watch = run(watch, ON_TIME_MS, 50_000)
    expect(watch.level).toBe('balanced')
  })

  it('does not flap: each failed step up doubles the quiet spell it waits for next', () => {
    const changes: [number, QualityLevel][] = []
    let watch = startWatch('full', 0)
    // A machine that holds 30 at balanced and cannot at full, for half an hour.
    while (watch.lastSampleMs < 30 * 60_000) {
      watch = run(watch, watch.level === 'full' ? 60 : ON_TIME_MS, 1_000, changes)
    }
    const stepUps = changes.filter(([, level]) => level === 'full').map(([timeMs]) => timeMs)
    expect(stepUps.length).toBeLessThanOrEqual(4)
    const waits = stepUps.map((timeMs, index) => timeMs - (stepUps[index - 1] ?? 0))
    for (let index = 2; index < waits.length; index++)
      expect(waits[index]).toBeGreaterThan(waits[index - 1] * 1.5)
  })

  it('has nowhere to step from light down or from full up', () => {
    expect(run(startWatch('light', 0), 200, 30_000).level).toBe('light')
    expect(run(startWatch('full', 0), ON_TIME_MS, 300_000).level).toBe('full')
  })
})
