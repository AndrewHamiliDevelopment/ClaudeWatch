import { Color } from 'three'
import { describe, expect, it } from 'vitest'
import { EDO } from '../themes/palettes'
import { contains, type Rect } from '../themes/lot-math'
import { GROUND_Y } from '../themes/surroundings'
import { fallbackDress } from './fallback-dress'
import { campusClaim, neededClaim } from './town-claim'
import { groundBuffers, groundQuads, type GroundQuad } from './town-ground'
import { planTown } from './town-plan'
import { TOWN_DISTRICTS } from './town-zones'
import { LARGE_FLOOR, roadStrip } from './town.test-utils'

const plan = planTown(campusClaim(neededClaim(LARGE_FLOOR), null), 'full')
const dress = fallbackDress(EDO)
const quads = groundQuads(plan, dress)
const of = (layer: GroundQuad['layer']): GroundQuad[] =>
  quads.filter((quad) => quad.layer === layer)
const same = (a: Rect, b: Rect): boolean => contains(a, b) && contains(b, a)

describe('groundQuads', () => {
  it('lays a pad under every block in its zone’s ground colour', () => {
    const pads = of('pad')
    expect(pads).toHaveLength(plan.blocks.length)
    for (const block of plan.blocks) {
      const pad = pads.find((quad) => same(quad, block))
      expect(pad?.color, block.id).toBe(dress.looks[block.zone].ground)
    }
    expect(new Set(pads.map((pad) => pad.color)).size).toBe(TOWN_DISTRICTS.length)
  })

  it('covers the part of a block the claim cuts with the campus ground', () => {
    const [campus] = of('campus')
    expect(same(campus, plan.claim)).toBe(true)
    expect(campus.y).toBeGreaterThan(of('pad')[0].y)
  })

  it('paves every road, with a carriageway down each one a vehicle may use', () => {
    const paved = of('sidewalk')
    const driven = of('carriageway')
    for (const road of plan.roads) {
      const strip = roadStrip(road)
      expect(
        paved.some((quad) => contains(quad, strip)),
        road.id
      ).toBe(true)
      // The boulevard's is carried past its ends to square the corners off.
      const lanes = driven.filter(
        (quad) =>
          quad.x === strip.x &&
          quad.z === strip.z &&
          quad.width > quad.depth === strip.width > strip.depth
      )
      expect(lanes.length > 0, road.id).toBe(road.class !== 'lane')
    }
    for (const quad of driven) expect(quad.color).toBe(dress.roads.carriageway)
    for (const quad of paved) expect(quad.color).toBe(dress.roads.sidewalk)
  })

  it('lays the median, the boulevard’s inner walk and the gate plaza on top, in the light colour', () => {
    const walks = of('promenade')
    // Four sides of the boulevard, the avenue's median and the plaza.
    expect(walks.length).toBeGreaterThanOrEqual(6)
    const top = Math.max(...quads.map((quad) => quad.y))
    for (const walk of walks) {
      expect(walk.color).toBe(dress.roads.promenade)
      expect(walk.y).toBe(top)
    }
    const plaza = walks.find((walk) => contains(walk, { x: -19, z: 0, width: 1, depth: 1 }))
    expect(plaza).toBeDefined()
  })

  it('stacks the layers in order, all between the horizon ground and the floor plate', () => {
    const order: GroundQuad['layer'][] = [
      'pad',
      'campus',
      'street',
      'sidewalk',
      'carriageway',
      'promenade'
    ]
    const heights = order.map((layer) => of(layer)[0].y)
    expect([...heights].sort((a, b) => a - b)).toEqual(heights)
    expect(new Set(heights).size).toBe(order.length)
    for (const quad of quads) {
      expect(quad.y).toBeGreaterThan(GROUND_Y)
      expect(quad.y).toBeLessThan(GROUND_Y + 0.1)
    }
  })
})

describe('groundBuffers', () => {
  it('is two triangles a quad, flat at its height and coloured at every corner', () => {
    const { positions, colors } = groundBuffers(quads)
    expect(positions).toHaveLength(quads.length * 18)
    expect(colors).toHaveLength(positions.length)
    const [first] = quads
    const colour = new Color(first.color)
    for (let corner = 0; corner < 6; corner++) {
      expect(positions[corner * 3 + 1]).toBeCloseTo(first.y)
      expect(Math.abs(positions[corner * 3] - first.x)).toBeCloseTo(first.width / 2)
      expect(Math.abs(positions[corner * 3 + 2] - first.z)).toBeCloseTo(first.depth / 2)
      expect(colors[corner * 3]).toBeCloseTo(colour.r)
      expect(colors[corner * 3 + 2]).toBeCloseTo(colour.b)
    }
  })

  it('faces up, so the ground is seen from above', () => {
    const { positions } = groundBuffers(quads.slice(0, 1))
    const [ax, , az, bx, , bz, cx, , cz] = positions
    // The y part of (b - a) x (c - a).
    expect((bz - az) * (cx - ax) - (bx - ax) * (cz - az)).toBeGreaterThan(0)
  })
})
