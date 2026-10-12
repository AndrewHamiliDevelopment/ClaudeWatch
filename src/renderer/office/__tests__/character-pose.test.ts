import { describe, expect, it } from 'vitest'
import { approach, approachAngle, moodFor, robotPose, steamPuffs } from '../logic/character-pose'

describe('moodFor', () => {
  it('puts needs-you above everything, then walking, then the activity', () => {
    expect(moodFor({ activity: 'editing', attention: 'permission' }, false)).toBe('needs-you')
    expect(moodFor({ activity: 'idle', attention: 'question' }, true)).toBe('needs-you')
    expect(moodFor({ activity: 'editing', attention: 'none' }, true)).toBe('walking')
    expect(moodFor({ activity: 'running', attention: 'none' }, false)).toBe('working')
    expect(moodFor({ activity: 'searching', attention: 'none' }, false)).toBe('reading')
    expect(moodFor({ activity: 'delegating', attention: 'none' }, false)).toBe('thinking')
    expect(moodFor({ activity: 'idle', attention: 'done' }, false)).toBe('idle')
  })

  it('lounges only when the agent has arrived at its lounge seat', () => {
    const resting = { activity: 'idle', attention: 'done', place: 'lounge' } as const
    expect(moodFor(resting, false)).toBe('lounging')
    expect(moodFor(resting, true)).toBe('walking')
    expect(moodFor({ ...resting, attention: 'question' }, false)).toBe('needs-you')
  })
})

describe('robotPose', () => {
  it('taps both arms out of step and spins the gear fast while working', () => {
    const pose = robotPose('working', 0.1, 0)
    expect(pose.leftArm).not.toBeCloseTo(pose.rightArm)
    expect(pose.gearSpeed).toBeGreaterThan(3)
  })

  it('tilts the head down to read and spins the gear slowly to think', () => {
    expect(robotPose('reading', 0.3, 0).headPitch).toBeGreaterThan(0.2)
    const thinking = robotPose('thinking', 0.3, 0).gearSpeed
    expect(thinking).toBeGreaterThan(0)
    expect(thinking).toBeLessThan(robotPose('working', 0.3, 0).gearSpeed)
  })

  it('raises an arm to wave when it needs you', () => {
    expect(robotPose('needs-you', 0.3, 0).rightArm).toBeLessThan(-2)
  })

  it('blinks now and then while idle', () => {
    const eyes = Array.from(
      { length: 400 },
      (_, index) => robotPose('idle', index * 0.01, 0).eyeOpen
    )
    expect(Math.min(...eyes)).toBeLessThan(0.5)
    expect(Math.max(...eyes)).toBe(1)
  })

  it('holds the posture but drops all motion under reduced motion', () => {
    const pose = robotPose('needs-you', 0.37, 0, { isReducedMotion: true })
    expect(pose.bob).toBe(0)
    expect(pose.gearSpeed).toBe(0)
    expect(pose.rightArm).toBeLessThan(-2)
    expect(robotPose('working', 0.37, 0, { isReducedMotion: true }).leftArm).toBe(
      robotPose('working', 0.91, 0, { isReducedMotion: true }).leftArm
    )
  })
})

describe('lounging pose', () => {
  it('sits low and leans back, moving slowly and with no gear', () => {
    const poses = Array.from({ length: 200 }, (_, index) => robotPose('lounging', index * 0.05, 0))
    for (const pose of poses) {
      expect(pose.bob).toBeLessThan(-0.05)
      expect(pose.lean).toBeLessThan(0)
      expect(pose.gearSpeed).toBe(0)
    }
    const bobs = poses.map((pose) => pose.bob)
    expect(Math.max(...bobs) - Math.min(...bobs)).toBeGreaterThan(0)
    expect(Math.max(...bobs) - Math.min(...bobs)).toBeLessThan(0.05)
  })

  it('holds still under reduced motion', () => {
    expect(robotPose('lounging', 0.4, 0, { isReducedMotion: true })).toEqual(
      robotPose('lounging', 7.3, 0.5, { isReducedMotion: true })
    )
  })

  it('leaves a working agent upright, exactly as before the lounge existed', () => {
    expect(robotPose('working', 0.37, 0.2, { isReducedMotion: true })).toEqual({
      bob: 0,
      sway: 0,
      lean: 0,
      headPitch: 0,
      leftArm: -0.95,
      rightArm: -0.95,
      rightArmRoll: 0,
      gearSpeed: 0,
      eyeOpen: 1
    })
    const moving = robotPose('working', 0.37, 0.2)
    expect(moving.lean).toBe(0)
    expect(moving.bob).toBe(0)
    expect(moving.gearSpeed).toBe(6)
  })
})

describe('steamPuffs', () => {
  it('rises and fades each puff, and rests between bursts', () => {
    const early = steamPuffs(0.2, 0)[0]
    const late = steamPuffs(0.9, 0)[0]
    expect(late.y).toBeGreaterThan(early.y)
    expect(late.opacity).toBeLessThan(early.opacity)
    expect(steamPuffs(2.5, 0).every((puff) => puff.opacity === 0)).toBe(true)
  })
})

describe('approach', () => {
  it('moves toward the target without overshooting', () => {
    const next = approach(0, 10, 0.1, 8)
    expect(next).toBeGreaterThan(0)
    expect(next).toBeLessThan(10)
    expect(approach(0, 10, 100, 8)).toBeCloseTo(10)
  })

  it('turns the short way round across the ±PI seam', () => {
    const next = approachAngle(Math.PI - 0.1, -Math.PI + 0.1, 0.05, 8)
    const delta = Math.atan2(Math.sin(next - (Math.PI - 0.1)), Math.cos(next - (Math.PI - 0.1)))
    expect(delta).toBeGreaterThan(0)
  })
})
