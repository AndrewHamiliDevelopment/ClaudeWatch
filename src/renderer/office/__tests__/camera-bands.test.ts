import { describe, expect, it } from 'vitest'
import {
  BAND_ZOOM,
  buildingFraming,
  bandForZoom,
  followAnchor,
  followStep,
  ISO_POLAR,
  snapAzimuth
} from '../logic/camera-bands'

const DEG = Math.PI / 180

describe('camera bands', () => {
  it('reads the band off the zoom: desk up close, building below the floor fit', () => {
    expect(bandForZoom(BAND_ZOOM.desk, 'floor', 8.2)).toBe('desk')
    expect(bandForZoom(8.2, 'floor', 8.2)).toBe('floor')
    expect(bandForZoom(34, 'floor', 8.2)).toBe('floor')
    expect(bandForZoom(4.5, 'floor', 8.2)).toBe('building')
  })

  it('measures the building threshold against the floor fit, not a fixed zoom', () => {
    // A lone office fits at 60 px/m: 30 is already further out than its floor view.
    expect(bandForZoom(30, 'floor', 60)).toBe('building')
    expect(bandForZoom(30, 'floor', 8.2)).toBe('floor')
  })

  it('keeps a floor level between desk and building for a lone office that fits at 60', () => {
    expect(bandForZoom(47, 'desk', 60)).toBe('floor')
    expect(bandForZoom(39, 'floor', 60)).toBe('floor')
    expect(bandForZoom(38, 'floor', 60)).toBe('building')
    expect(bandForZoom(43, 'building', 60)).toBe('building')
    expect(bandForZoom(44, 'building', 60)).toBe('floor')
    expect(bandForZoom(54, 'floor', 60)).toBe('floor')
  })

  it('enters desk at 55 px/m and leaves it under 48', () => {
    expect(bandForZoom(54, 'floor', 8.2)).toBe('floor')
    expect(bandForZoom(55, 'floor', 8.2)).toBe('desk')
    expect(bandForZoom(50, 'desk', 8.2)).toBe('desk')
    expect(bandForZoom(47, 'desk', 8.2)).toBe('floor')
  })

  it('enters building under 0.8 of the fit and leaves it above 0.9', () => {
    expect(bandForZoom(8.1, 'floor', 10)).toBe('floor')
    expect(bandForZoom(7.9, 'floor', 10)).toBe('building')
    expect(bandForZoom(8.9, 'building', 10)).toBe('building')
    expect(bandForZoom(9.1, 'building', 10)).toBe('floor')
  })

  it('changes band at most once when the zoom wobbles 10 % around a threshold', () => {
    for (const threshold of [55, 8]) {
      let band = bandForZoom(threshold * 0.9, 'floor', 10)
      let changes = 0
      for (const factor of [1.0, 1.05, 0.95, 1.05, 0.95, 1.02, 0.98]) {
        const next = bandForZoom(threshold * factor, band, 10)
        if (next !== band) changes += 1
        band = next
      }
      expect(changes).toBeLessThanOrEqual(1)
    }
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
})

it('fits the district, hangar and tall tower inside a small building viewport', () => {
  const framing = buildingFraming({ width: 88, depth: 42 }, 12, { width: 800, height: 600 })
  expect(framing.zoom).toBeLessThanOrEqual(BAND_ZOOM.building)
  expect(framing.zoom * framing.projectedWidth).toBeLessThan(800)
  expect(framing.zoom * framing.projectedHeight).toBeLessThan(600)
  expect(framing.target[1]).toBeGreaterThan(0)
  expect(framing.target[2]).toBeLessThan(0)
})

it('aims the building view at the scene where it lies, not at the gate', () => {
  const viewport = { width: 800, height: 600 }
  const centred = buildingFraming({ width: 88, depth: 42 }, 12, viewport)
  const offCentre = buildingFraming({ x: 34, z: 7, width: 88, depth: 42 }, 12, viewport)
  expect(offCentre.target).toEqual([
    centred.target[0] + 34,
    centred.target[1],
    centred.target[2] + 7
  ])
  expect(offCentre.zoom).toBe(centred.zoom)
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
