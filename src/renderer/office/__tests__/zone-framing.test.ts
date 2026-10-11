import { describe, expect, it } from 'vitest'
import { ISO_START_AZIMUTH } from '../logic/camera-bands'
import {
  boundsOfZone,
  cardSafeArea,
  frameBounds,
  HUD_SAFE_INSETS,
  occupiedBounds,
  projectToScreen,
  type Bounds,
  type ScreenView
} from '../logic/zone-framing'
import { makeFloor, makeRoom, makeZone } from './fixtures'

const VIEWPORT = { width: 1440, height: 900 }
const CARD_HEIGHT_M = 2.6

function corners(bounds: Bounds) {
  return [bounds.minX, bounds.maxX].flatMap((x) =>
    [bounds.minZ, bounds.maxZ].flatMap((z) => [0, CARD_HEIGHT_M].map((y) => ({ x, y, z })))
  )
}

function expectInsideSafeArea(bounds: Bounds, view: ScreenView) {
  for (const corner of corners(bounds)) {
    const point = projectToScreen(corner, view, VIEWPORT)
    expect(point.x).toBeGreaterThanOrEqual(HUD_SAFE_INSETS.left - 0.5)
    expect(point.x).toBeLessThanOrEqual(VIEWPORT.width - HUD_SAFE_INSETS.right + 0.5)
    expect(point.y).toBeGreaterThanOrEqual(HUD_SAFE_INSETS.top - 0.5)
    expect(point.y).toBeLessThanOrEqual(VIEWPORT.height - HUD_SAFE_INSETS.bottom + 0.5)
  }
}

function project(id: string, x: number, z: number, sessionKey: string) {
  return makeZone({
    id,
    kind: 'project',
    projectKey: id,
    x,
    z,
    width: 8,
    depth: 7,
    children: [makeZone({ id: `${id}/o`, kind: 'office', sessionKey, x, z })]
  })
}

describe('occupiedBounds', () => {
  it('frames only the project offices that hold a live session, padded', () => {
    const floor = makeFloor({
      floorId: 'f',
      width: 120,
      depth: 80,
      zones: [
        makeZone({
          id: 'c',
          kind: 'company',
          width: 100,
          depth: 70,
          children: [project('busy', 50, 30, 'claude:a'), project('empty', -40, -30, 'claude:gone')]
        })
      ]
    })
    const bounds = occupiedBounds(floor, new Set(['claude:a']))
    expect(bounds.minX).toBeLessThan(46)
    expect(bounds.maxX).toBeGreaterThan(54)
    expect(bounds.minX).toBeGreaterThan(40)
    expect(bounds.minZ).toBeGreaterThan(20)
  })

  it('falls back to the leaf rooms, then the plate, when nothing is zoned', () => {
    const rooms = makeFloor({
      floorId: 'f',
      rooms: [makeRoom({ id: 'r', sessionKey: 'claude:a', x: 3, z: 4 })]
    })
    expect(occupiedBounds(rooms, new Set(['claude:a'])).minX).toBeGreaterThan(-5)
    const plate = occupiedBounds(makeFloor({ floorId: 'f', width: 20, depth: 16 }), new Set())
    expect(plate).toEqual({ minX: -10, maxX: 10, minZ: -8, maxZ: 8 })
  })
})

describe('cardSafeArea', () => {
  it('keeps name cards off the left rail, the right panel and the bottom bar', () => {
    expect(cardSafeArea(VIEWPORT)).toEqual({
      left: HUD_SAFE_INSETS.left,
      right: VIEWPORT.width - HUD_SAFE_INSETS.right,
      top: 0,
      bottom: VIEWPORT.height - HUD_SAFE_INSETS.bottom
    })
  })

  it('uses the full width once the rails stack on a narrow window', () => {
    expect(cardSafeArea({ width: 700, height: 900 })).toMatchObject({ left: 0, right: 700 })
  })
})

describe('frameBounds', () => {
  it('keeps a lone office at the plate edge clear of the HUD rails', () => {
    const bounds = boundsOfZone(
      makeZone({ id: 'edge', kind: 'project', x: 58, z: 38, width: 8, depth: 7 })
    )
    const framing = frameBounds(bounds, VIEWPORT, { azimuth: ISO_START_AZIMUTH })
    expectInsideSafeArea(bounds, { ...framing, azimuth: ISO_START_AZIMUTH })
  })

  it('fits many offices inside the safe area at every isometric corner', () => {
    const bounds: Bounds = { minX: -60, maxX: 60, minZ: -40, maxZ: 40 }
    for (const azimuth of [
      ISO_START_AZIMUTH,
      ISO_START_AZIMUTH + Math.PI / 2,
      ISO_START_AZIMUTH + Math.PI
    ]) {
      const framing = frameBounds(bounds, VIEWPORT, { azimuth })
      expectInsideSafeArea(bounds, { ...framing, azimuth })
    }
  })

  it('still fits the safe area at a free, non-snapped rotation', () => {
    const bounds: Bounds = { minX: 20, maxX: 44, minZ: -30, maxZ: -6 }
    for (const azimuth of [0.3, 1.2217, 2.9, -1.9]) {
      const framing = frameBounds(bounds, VIEWPORT, { azimuth })
      expectInsideSafeArea(bounds, { ...framing, azimuth })
    }
  })

  it('does not zoom a single office closer than the floor band allows', () => {
    const framing = frameBounds({ minX: -1, maxX: 1, minZ: -1, maxZ: 1 }, VIEWPORT, {
      azimuth: ISO_START_AZIMUTH,
      maxZoom: 60
    })
    expect(framing.zoom).toBe(60)
  })
})
