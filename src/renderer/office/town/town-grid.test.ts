import { describe, expect, it } from 'vitest'
import { QUALITY_LEVELS } from '../logic/quality'
import {
  BLOCK_PITCH_M,
  BUILDING_CAP,
  CLAIM_RELEASE_M,
  GREEN_PITCH_M,
  LOT_PITCH_M,
  MIN_BELT_M,
  OLD_TOWN_BLOCKS,
  RING_M,
  ROAD_WIDTH_M,
  SIDEWALK_M,
  cellRect,
  latticeLines
} from './town-grid'

describe('the town lattices', () => {
  it('nest: a block is two lots across and a lot is two green plots across', () => {
    expect(BLOCK_PITCH_M).toBe(LOT_PITCH_M * 2)
    expect(LOT_PITCH_M).toBe(GREEN_PITCH_M * 2)
  })

  it('leave green between the boulevard and the plate', () => {
    expect(MIN_BELT_M).toBeGreaterThan(ROAD_WIDTH_M.boulevard)
  })

  it('hold an edge through more than one desk column (5 m) of shrinking', () => {
    expect(CLAIM_RELEASE_M).toBeGreaterThan(LOT_PITCH_M + 5)
  })

  it('leave a carriageway between the sidewalks of every road', () => {
    for (const road of ['avenue', 'boulevard', 'collector', 'lane'] as const)
      expect(ROAD_WIDTH_M[road]).toBeGreaterThan(SIDEWALK_M[road] * 2)
  })

  it('keep the ring and the old town on whole lots at every detail level', () => {
    for (const level of QUALITY_LEVELS) {
      expect(RING_M[level] % LOT_PITCH_M).toBe(0)
      expect(OLD_TOWN_BLOCKS[level]).toBeGreaterThan(0)
      expect(BUILDING_CAP[level]).toBeGreaterThan(0)
    }
  })

  it('draw less town at a lighter level', () => {
    expect(RING_M.light).toBeLessThanOrEqual(RING_M.balanced)
    expect(BUILDING_CAP.light).toBeLessThan(BUILDING_CAP.balanced)
    expect(BUILDING_CAP.balanced).toBeLessThan(BUILDING_CAP.full)
  })
})

describe('cellRect', () => {
  it('is the square whose north-west corner is the cell times the pitch', () => {
    expect(cellRect(0, 0, 12)).toEqual({ x: 6, z: 6, width: 12, depth: 12 })
    expect(cellRect(-3, 2, 12)).toEqual({ x: -30, z: 30, width: 12, depth: 12 })
    expect(cellRect(-1, -1, 6)).toEqual({ x: -3, z: -3, width: 6, depth: 6 })
  })
})

describe('latticeLines', () => {
  it('lists every line of the pitch from one edge to the other, both included', () => {
    expect(latticeLines(-24, 12, 12)).toEqual([-24, -12, 0, 12])
    expect(latticeLines(0, 48, 24)).toEqual([0, 24, 48])
  })

  it('never yields a negative zero', () => {
    expect(latticeLines(-12, 0, 12).some((line) => Object.is(line, -0))).toBe(false)
  })
})
