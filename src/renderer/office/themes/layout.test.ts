import { describe, expect, it } from 'vitest'
import { districtLayout, towerLayout, sensorOpening } from './layout'

describe('world layout', () => {
  it('keeps district props and their footprints outside the floor plate', () => {
    const floor = { width: 18, depth: 13 }
    const props = districtLayout(floor)
    expect(props).toEqual(districtLayout(floor))
    expect(new Set(props.map((prop) => prop.kind))).toEqual(
      new Set(['sakura', 'lantern', 'torii', 'pagoda', 'vent', 'eaves', 'airship'])
    )
    for (const prop of props) {
      expect(
        Math.abs(prop.x) - prop.radius > floor.width / 2 ||
          Math.abs(prop.z) - prop.radius > floor.depth / 2
      ).toBe(true)
    }
  })
  it('stacks floors in input order and preserves identity, labels and attention', () => {
    expect(
      towerLayout([
        { floorId: 'b', label: 'Forge', attentionCount: 2 },
        { floorId: 'a', label: 'Studio', attentionCount: 0 }
      ])
    ).toEqual([
      { floorId: 'b', label: 'Forge', attentionCount: 2, y: 0, width: 5 },
      { floorId: 'a', label: 'Studio', attentionCount: 0, y: 2.2, width: 4.8 }
    ])
    expect(towerLayout([])).toEqual([])
  })
  it('opens sensors for reading and thinking without changing other activities', () => {
    expect(sensorOpening('reading')).toBeCloseTo(-0.8)
    expect(sensorOpening('thinking')).toBeCloseTo(-0.8)
    expect(sensorOpening('idle')).toBe(0)
    expect(sensorOpening('editing')).toBe(0)
  })
})
