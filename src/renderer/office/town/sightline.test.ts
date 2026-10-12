import { describe, expect, it } from 'vitest'
import { ISO_START_AZIMUTH } from '../logic/camera-bands'
import { MAP_ROTATIONS, isHidden, plainSightShare, type SightBox } from './sightline.test-utils'

const HERE = { x: 0, z: 0 }
const boxAt = (x: number, z: number, height: number): SightBox => ({
  x,
  z,
  width: 2,
  depth: 2,
  height
})

describe('isHidden', () => {
  it('looks from the four map rotations, a quarter turn apart', () => {
    expect(MAP_ROTATIONS).toHaveLength(4)
    expect(MAP_ROTATIONS[0]).toBe(ISO_START_AZIMUTH)
    expect(MAP_ROTATIONS[1] - MAP_ROTATIONS[0]).toBeCloseTo(Math.PI / 2)
  })

  it('hides a ground point behind a box tall enough to cover the sightline', () => {
    // The camera stands toward +x +z; the box's near corner is 2.83 m away, where the line of
    // sight has risen 1.98 m.
    expect(isHidden(HERE, [boxAt(3, 3, 2)], ISO_START_AZIMUTH)).toBe(true)
    expect(isHidden(HERE, [boxAt(3, 3, 1.9)], ISO_START_AZIMUTH)).toBe(false)
  })

  it('leaves a point in sight when the box stands behind it or to one side', () => {
    expect(isHidden(HERE, [boxAt(-3, -3, 20)], ISO_START_AZIMUTH)).toBe(false)
    expect(isHidden(HERE, [boxAt(3, -3, 20)], ISO_START_AZIMUTH)).toBe(false)
  })

  it('hides the same point from the opposite rotation only', () => {
    const behind = [boxAt(-3, -3, 20)]
    expect(isHidden(HERE, behind, MAP_ROTATIONS[2])).toBe(true)
    expect(isHidden(HERE, behind, MAP_ROTATIONS[1])).toBe(false)
  })

  it('hides a point that stands inside a box', () => {
    expect(isHidden(HERE, [boxAt(0, 0, 0.5)], ISO_START_AZIMUTH)).toBe(true)
  })
})

describe('plainSightShare', () => {
  it('is the part of the points no box hides', () => {
    const points = [HERE, { x: 20, z: 20 }]
    expect(plainSightShare(points, [boxAt(3, 3, 5)], ISO_START_AZIMUTH)).toBe(0.5)
    expect(plainSightShare([], [], ISO_START_AZIMUTH)).toBe(1)
  })
})
