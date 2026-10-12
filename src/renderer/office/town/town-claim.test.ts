import { describe, expect, it } from 'vitest'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import { campusClaim, heldClaim, neededClaim } from './town-claim'
import { CLAIM_RELEASE_M, LOT_PITCH_M, MIN_BELT_M } from './town-grid'
import { LONE_FLOOR, edges, fromEdges, widened } from './town.test-utils'

const DESK_COLUMN_M = 5

describe('neededClaim', () => {
  it('is the plate grown by the belt on every side, and nothing else of the floor', () => {
    expect(neededClaim(LONE_FLOOR)).toEqual({
      x: LONE_FLOOR.x,
      z: LONE_FLOOR.z,
      width: LONE_FLOOR.width + MIN_BELT_M * 2,
      depth: LONE_FLOOR.depth + MIN_BELT_M * 2
    })
  })
})

describe.each(LIVE_FLOORS)('campusClaim on a first start: %s', (_name, floor) => {
  const needed = neededClaim(floor)
  const claim = edges(campusClaim(needed, null))

  it('lies on the 12 m lines', () => {
    for (const edge of Object.values(claim)) expect(Math.abs(edge % LOT_PITCH_M)).toBe(0)
  })

  it('contains what the campus needs, with less than the release distance to spare', () => {
    const want = edges(needed)
    const spare = [
      want.west - claim.west,
      claim.east - want.east,
      want.north - claim.north,
      claim.south - want.south
    ]
    for (const metres of spare) {
      expect(metres).toBeGreaterThanOrEqual(0)
      expect(metres).toBeLessThan(CLAIM_RELEASE_M)
    }
  })

  it('puts the west edge at -24, where the old town begins', () => {
    expect(claim.west).toBe(-24)
  })

  it('is the same claim every time', () => {
    expect(campusClaim(neededClaim(floor), null)).toEqual(campusClaim(needed, null))
  })
})

describe.each(LIVE_FLOORS)('campusClaim holding an edge: %s', (_name, floor) => {
  const first = campusClaim(neededClaim(floor), null)
  const spare = edges(first).east - edges(neededClaim(floor)).east

  it('does not move while the campus grows short of the edge', () => {
    const grown = neededClaim(widened(floor, spare))
    expect(campusClaim(grown, first)).toEqual(first)
  })

  it('steps one line of lots when a desk column passes the edge, and only on that side', () => {
    const past = campusClaim(neededClaim(widened(floor, spare + 1)), first)
    expect(edges(past)).toEqual({ ...edges(first), east: edges(first).east + LOT_PITCH_M })
  })

  it('does not come back when that desk column leaves again', () => {
    const past = campusClaim(neededClaim(widened(floor, spare + 1)), first)
    const back = campusClaim(neededClaim(widened(floor, spare + 1 - DESK_COLUMN_M)), past)
    expect(back).toEqual(past)
  })

  it('releases the edge once the campus needs 18 m less', () => {
    const big = campusClaim(neededClaim(widened(floor, 60)), first)
    expect(campusClaim(neededClaim(floor), big)).toEqual(first)
  })

  it('ends on the first claim after walking east 40 m and back in 1 m steps', () => {
    let claim = first
    const seen = new Set<number>()
    for (let metres = 1; metres <= 40; metres++) {
      claim = campusClaim(neededClaim(widened(floor, metres)), claim)
      seen.add(edges(claim).east)
    }
    expect(seen.size).toBeGreaterThan(1)
    for (let metres = 39; metres >= 0; metres--)
      claim = campusClaim(neededClaim(widened(floor, metres)), claim)
    expect(claim).toEqual(first)
  })

  it('never grows without the campus: a desk column coming and going 50 times moves nothing', () => {
    let claim = campusClaim(neededClaim(widened(floor, spare + 1)), first)
    const settled = claim
    for (let turn = 0; turn < 50; turn++) {
      claim = campusClaim(neededClaim(widened(floor, spare + 1 - DESK_COLUMN_M)), claim)
      claim = campusClaim(neededClaim(widened(floor, spare + 1)), claim)
    }
    expect(claim).toEqual(settled)
  })
})

describe('heldClaim', () => {
  const needed = neededClaim(LONE_FLOOR)
  const good = edges(campusClaim(needed, null))

  it('accepts four numbers on the 12 m lines that contain what the campus needs', () => {
    expect(heldClaim({ version: 1, ...good }, needed)).toEqual(fromEdges(good))
  })

  it.each([
    ['nothing stored', null],
    ['text', '{"west":-24}'],
    ['a list', [-24, 36, -24, 36]],
    ['a missing edge', { west: good.west, east: good.east, north: good.north }],
    ['a number as text', { ...good, east: String(good.east) }],
    ['an edge off the lattice', { ...good, east: good.east + 1 }],
    ['an edge that is not a number at all', { ...good, south: Number.NaN }],
    ['an endless edge', { ...good, east: Number.POSITIVE_INFINITY }],
    ['a claim the campus has outgrown', { ...good, east: good.east - LOT_PITCH_M * 2 }],
    ['a claim turned inside out', { ...good, west: good.east, east: good.west }]
  ])('drops %s', (_name, stored) => {
    expect(heldClaim(stored, needed)).toBeNull()
  })
})
