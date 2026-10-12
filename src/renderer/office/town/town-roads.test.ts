import { describe, expect, it } from 'vitest'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import { campusClaim, neededClaim } from './town-claim'
import { AVENUE_MEDIAN_M, BLOCK_PITCH_M, LOT_PITCH_M, ROAD_WIDTH_M, SIDEWALK_M } from './town-grid'
import { roadPromenades, standingOn, townRoads } from './town-roads'
import { edges, fromEdges, fullExtent, overlapping, roadStrip } from './town.test-utils'

describe.each(LIVE_FLOORS)('townRoads: %s', (_name, floor) => {
  const claim = campusClaim(neededClaim(floor), null)
  const extent = fullExtent(claim)
  const roads = townRoads(claim, extent)
  const edge = edges(claim)
  const outer = roads.filter((road) => road.class !== 'boulevard')

  it('gives every road its own id, the width of its class and a straight centre line', () => {
    expect(new Set(roads.map((road) => road.id)).size).toBe(roads.length)
    for (const road of roads) {
      expect(road.width).toBe(ROAD_WIDTH_M[road.class])
      expect(road.from.x === road.to.x || road.from.z === road.to.z).toBe(true)
    }
  })

  it('runs collectors on the 24 m lines and lanes on the 12 m lines between', () => {
    for (const road of outer.filter((each) => each.class !== 'avenue')) {
      const line = road.from.x === road.to.x ? road.from.x : road.from.z
      expect(Math.abs(line % BLOCK_PITCH_M)).toBe(road.class === 'collector' ? 0 : LOT_PITCH_M)
    }
  })

  it('has one avenue, on z = 0 from the west edge of town to the claim', () => {
    const avenues = roads.filter((road) => road.class === 'avenue')
    expect(avenues).toHaveLength(1)
    expect(avenues[0]).toMatchObject({
      id: 'avenue',
      from: { x: edges(extent).west, z: 0 },
      to: { x: edge.west, z: 0 }
    })
  })

  it('carries the campus street on east of the claim as a collector', () => {
    const east = roads.find(
      (road) => road.from.z === 0 && road.to.z === 0 && road.from.x === edge.east
    )
    expect(east).toMatchObject({ class: 'collector', to: { x: edges(extent).east, z: 0 } })
  })

  it('keeps every town road off the claim', () => {
    for (const road of outer) expect(overlapping(roadStrip(road), claim)).toBe(false)
  })

  it('lays the boulevard as four strips inside the claim, against its edge', () => {
    const reach = roads
      .filter((road) => road.class === 'boulevard')
      .map(roadStrip)
      .map(edges)
    expect(reach).toHaveLength(4)
    expect(Math.min(...reach.map((each) => each.west))).toBe(edge.west)
    expect(Math.max(...reach.map((each) => each.east))).toBe(edge.east)
    expect(Math.min(...reach.map((each) => each.north))).toBe(edge.north)
    expect(Math.max(...reach.map((each) => each.south))).toBe(edge.south)
  })

  it('says what stands on a line: the claim edge, the avenue, a collector or a lane', () => {
    expect(standingOn('x', edge.east, 0, claim)).toBe('boulevard')
    expect(standingOn('z', edge.north, 6, claim)).toBe('boulevard')
    expect(standingOn('x', edge.east, edge.south + 6, claim)).toBe(
      edge.east % BLOCK_PITCH_M === 0 ? 'collector' : 'lane'
    )
    expect(standingOn('z', 0, edge.west - 6, claim)).toBe('avenue')
    expect(standingOn('z', 0, edge.east + 6, claim)).toBe('collector')
    expect(standingOn('x', -48, 6, claim)).toBe('collector')
    expect(standingOn('x', -36, 6, claim)).toBe('lane')
  })

  it('protects the inner sidewalk of the boulevard and the median of the avenue', () => {
    const promenades = roadPromenades(roads, claim)
    expect(promenades).toHaveLength(5)
    const inner = ROAD_WIDTH_M.boulevard - SIDEWALK_M.boulevard
    const walks = promenades.slice(0, 4).map(edges)
    expect(Math.min(...walks.map((walk) => walk.west))).toBe(edge.west + inner)
    expect(Math.max(...walks.map((walk) => walk.east))).toBe(edge.east - inner)
    expect(Math.min(...walks.map((walk) => walk.north))).toBe(edge.north + inner)
    expect(Math.max(...walks.map((walk) => walk.south))).toBe(edge.south - inner)
    for (const walk of promenades.slice(0, 4))
      expect(Math.min(walk.width, walk.depth)).toBe(SIDEWALK_M.boulevard)
    expect(promenades[4]).toEqual(
      fromEdges({
        west: edges(extent).west,
        east: edge.west,
        north: -AVENUE_MEDIAN_M / 2,
        south: AVENUE_MEDIAN_M / 2
      })
    )
  })
})
