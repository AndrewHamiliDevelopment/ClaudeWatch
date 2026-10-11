import { describe, expect, it } from 'vitest'
import { shojiParts } from './shoji-layout'

describe('shoji lattice layout', () => {
  it('spans horizontal beams across the entire wall and leaves door gaps to the room helper', () => {
    const parts = shojiParts({ roomId: 'room', x: 2, z: 3, length: 4, normalX: 0, normalZ: 1 }, 1.3)
    const beams = parts.bars.filter((bar) => bar.scaleY === 0.035)
    expect(beams).toHaveLength(3)
    for (const beam of beams) expect((beam.scaleX ?? 1) * 0.035).toBeCloseTo(4)
    expect(parts.panel.scaleY).toBe(1.3)
  })
  it('rotates wall parts along the east/west wall without changing their height', () => {
    const parts = shojiParts(
      { roomId: 'room', x: 2, z: 3, length: 2, normalX: 1, normalZ: 0 },
      0.25
    )
    expect(parts.panel.rotationY).toBe(Math.PI / 2)
    expect(parts.panel.y).toBe(0.125)
    expect(parts.bars[0].x).toBeCloseTo(2)
    expect(parts.bars[0].z).toBeCloseTo(4)
    expect(parts.pipe.y).toBeCloseTo(0.33)
  })
})
