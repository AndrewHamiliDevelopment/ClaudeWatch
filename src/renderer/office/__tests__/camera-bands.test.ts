import { describe, expect, it } from 'vitest'
import {
  BAND_ZOOM,
  buildingFraming,
  bandForZoom,
  createWheelStepper,
  followAnchor,
  followStep,
  ISO_POLAR,
  snapAzimuth,
  stepBand
} from '../logic/camera-bands'

const DEG = Math.PI / 180

describe('camera bands', () => {
  it('steps through desk, floor and building bands and stops at the ends', () => {
    expect(stepBand('floor', 'out')).toBe('building')
    expect(stepBand('building', 'out')).toBe('building')
    expect(stepBand('floor', 'in')).toBe('desk')
    expect(stepBand('desk', 'in')).toBe('desk')
  })

  it('maps an orthographic zoom to the nearest band', () => {
    expect(bandForZoom(BAND_ZOOM.desk * 1.1)).toBe('desk')
    expect(bandForZoom(BAND_ZOOM.floor)).toBe('floor')
    expect(bandForZoom(1)).toBe('building')
  })

  it('fixes the isometric elevation at 35 degrees', () => {
    expect(ISO_POLAR).toBeCloseTo(55 * DEG)
  })

  it('rotates in 90 degree steps between the four isometric corners', () => {
    expect(snapAzimuth(45 * DEG, 1)).toBeCloseTo(135 * DEG)
    expect(snapAzimuth(45 * DEG, -1)).toBeCloseTo(-45 * DEG)
    expect(snapAzimuth(60 * DEG, -1)).toBeCloseTo(45 * DEG)
    expect(snapAzimuth(60 * DEG, 1)).toBeCloseTo(135 * DEG)
  })

  it('turns a burst of wheel deltas into one band step per gesture', () => {
    const step = createWheelStepper({ threshold: 50, cooldownMs: 300 })
    expect(step(20, 0)).toBeNull()
    expect(step(40, 10)).toBe('out')
    expect(step(200, 50)).toBeNull()
    expect(step(-80, 400)).toBe('in')
  })
})

it('fits the district, hangar and tall tower inside a small building viewport', () => {
  const framing = buildingFraming({ width: 64, depth: 16 }, 12, { width: 800, height: 600 })
  expect(framing.zoom).toBeLessThanOrEqual(BAND_ZOOM.building)
  expect(framing.zoom * framing.projectedWidth).toBeLessThan(800)
  expect(framing.zoom * framing.projectedHeight).toBeLessThan(600)
  expect(framing.target[1]).toBeGreaterThan(0)
  expect(framing.target[2]).toBeLessThan(0)
})

describe('desk follow', () => {
  const rooms = [{ id: 'r1', x: 10, z: 4 }]
  const agents = [{ agentKey: 'a', roomId: 'r1' }]
  const anchor = { agentKey: 'a', roomX: 10, roomZ: 4 }

  it('anchors on the centre of the room the agent sits in, not on the agent', () => {
    expect(followAnchor(agents[0], rooms)).toEqual(anchor)
    expect(followAnchor({ agentKey: 'a', roomId: 'gone' }, rooms)).toBeNull()
  })

  it('stays put while the room has not moved', () => {
    expect(followStep(anchor, agents, rooms)).toEqual({ kind: 'stay' })
  })

  it('shifts by the room delta when the office is re-packed', () => {
    expect(followStep(anchor, agents, [{ id: 'r1', x: 16, z: 1 }])).toEqual({
      kind: 'shift',
      dx: 6,
      dz: -3,
      anchor: { agentKey: 'a', roomX: 16, roomZ: 1 }
    })
  })

  it('follows the agent into a different room', () => {
    const moved = followStep(
      anchor,
      [{ agentKey: 'a', roomId: 'r2' }],
      [...rooms, { id: 'r2', x: 0, z: 0 }]
    )
    expect(moved).toMatchObject({ kind: 'shift', dx: -10, dz: -4 })
  })

  it('reports the agent lost once it has left the floor', () => {
    expect(followStep(anchor, [], rooms)).toEqual({ kind: 'lost' })
  })
})
