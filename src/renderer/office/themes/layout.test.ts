import { describe, expect, it } from 'vitest'
import { towerLayout, sensorOpening } from './layout'

describe('world layout', () => {
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
