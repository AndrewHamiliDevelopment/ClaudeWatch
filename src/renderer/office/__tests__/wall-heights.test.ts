import { describe, expect, it } from 'vitest'
import { roomWallSegments, WALL_HEIGHT_FULL, WALL_HEIGHT_LOW } from '../logic/room-layout'
import { createWallHeights } from '../logic/wall-heights'
import { makeRoom } from './fixtures'

const segments = roomWallSegments(makeRoom({ id: 'r1', x: 0, z: -4, door: { x: 0, z: -1.5 } }))
const CAMERA = { x: 0, z: 30 }

describe('createWallHeights', () => {
  it('reports a change on the first step and none once every wall has settled', () => {
    const walls = createWallHeights()
    expect(walls.step(segments, 'down', CAMERA, 0.033, false)).toBe(true)
    for (let frame = 0; frame < 200; frame += 1) walls.step(segments, 'down', CAMERA, 0.033, false)
    expect(walls.heights.every((height) => height === WALL_HEIGHT_LOW)).toBe(true)
    expect(walls.step(segments, 'down', CAMERA, 0.033, false)).toBe(false)
  })

  it('wakes again when the mode, the camera side or the wall set changes', () => {
    const walls = createWallHeights()
    for (let frame = 0; frame < 200; frame += 1)
      walls.step(segments, 'cutaway', CAMERA, 0.033, false)
    expect(walls.step(segments, 'cutaway', CAMERA, 0.033, false)).toBe(false)
    expect(walls.step(segments, 'cutaway', { x: 0, z: -30 }, 0.033, false)).toBe(true)
    expect(walls.step(segments, 'up', { x: 0, z: -30 }, 0.033, false)).toBe(true)
    for (let frame = 0; frame < 200; frame += 1) walls.step(segments, 'up', CAMERA, 0.033, false)
    expect(walls.step([...segments], 'up', CAMERA, 0.033, false)).toBe(true)
  })

  it('starts at the target by default, or eases from a given height', () => {
    const atTarget = createWallHeights()
    atTarget.step(segments, 'down', CAMERA, 0.033, false)
    expect(atTarget.heights[0]).toBe(WALL_HEIGHT_LOW)
    const fromFull = createWallHeights(WALL_HEIGHT_FULL)
    fromFull.step(segments, 'down', CAMERA, 0.033, false)
    expect(fromFull.heights[0]).toBeGreaterThan(WALL_HEIGHT_LOW)
    expect(fromFull.heights[0]).toBeLessThan(WALL_HEIGHT_FULL)
  })

  it('snaps under reduced motion', () => {
    const walls = createWallHeights(WALL_HEIGHT_FULL)
    walls.step(segments, 'down', CAMERA, 0.033, true)
    expect(walls.heights.every((height) => height === WALL_HEIGHT_LOW)).toBe(true)
  })
})
