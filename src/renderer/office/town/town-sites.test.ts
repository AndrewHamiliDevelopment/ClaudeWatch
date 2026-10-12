import { describe, expect, it } from 'vitest'
import { SIDE_NORMAL } from '../logic/room-layout'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import { hashOf } from '../themes/lot-math'
import { campusClaim, neededClaim } from './town-claim'
import {
  BLOCK_PITCH_M,
  CLAIM_SETBACK_M,
  LOT_PITCH_M,
  LOT_SIDE_MAX_M,
  ROAD_WIDTH_M,
  SIDEWALK_M
} from './town-grid'
import { townRoads } from './town-roads'
import { lotSites, parkPromenades, type LotSite } from './town-sites'
import { TOWN_DISTRICTS, blockOfCell, zoneOfBlock } from './town-zones'
import { edges, fullExtent, gap, overlapping, roadStrip } from './town.test-utils'

// Read back from the id on purpose: the name is the lot's identity.
function cellOf(lot: LotSite): { column: number; row: number } {
  const [, column, row] = lot.id.split(':').map(Number)
  return { column, row }
}

describe.each(LIVE_FLOORS)('lotSites: %s', (_name, floor) => {
  const claim = campusClaim(neededClaim(floor), null)
  const extent = fullExtent(claim)
  const roads = townRoads(claim, extent)
  const sites = lotSites(claim, extent)
  const byCell = new Map(sites.map((lot) => [`${cellOf(lot).column}:${cellOf(lot).row}`, lot]))
  const firstRing = sites.filter((lot) => gap(lot, claim) === CLAIM_SETBACK_M)

  it('names every lot after its 12 m cell and seeds it from that name', () => {
    expect(new Set(sites.map((lot) => lot.id)).size).toBe(sites.length)
    for (const lot of sites) {
      const { column, row } = cellOf(lot)
      expect(lot.id).toBe(`lot:${column}:${row}`)
      expect(lot.seed).toBe(hashOf(lot.id))
      expect(Math.abs(lot.x - (column + 0.5) * LOT_PITCH_M)).toBeLessThan(LOT_PITCH_M / 2)
      expect(Math.abs(lot.z - (row + 0.5) * LOT_PITCH_M)).toBeLessThan(LOT_PITCH_M / 2)
    }
  })

  it('keeps every lot outside the claim and inside the town', () => {
    for (const lot of sites) {
      expect(overlapping(lot, claim)).toBe(false)
      expect(gap(lot, claim)).toBeGreaterThanOrEqual(CLAIM_SETBACK_M)
      expect(edges(lot).west).toBeGreaterThanOrEqual(edges(extent).west)
      expect(edges(lot).east).toBeLessThanOrEqual(edges(extent).east)
      expect(edges(lot).north).toBeGreaterThanOrEqual(edges(extent).north)
      expect(edges(lot).south).toBeLessThanOrEqual(edges(extent).south)
    }
  })

  it('keeps every lot off every road', () => {
    const strips = roads.map(roadStrip)
    for (const lot of sites) expect(strips.some((road) => overlapping(lot, road))).toBe(false)
  })

  it('lets no two sites overlap', () => {
    sites.forEach((lot, index) => {
      for (const other of sites.slice(index + 1)) expect(overlapping(lot, other)).toBe(false)
    })
  })

  it('sizes a lot at most 8 m a side: 8 x 8 on a street, 5 m deep on the avenue', () => {
    for (const lot of sites) {
      expect(Math.max(lot.width, lot.depth)).toBeLessThanOrEqual(LOT_SIDE_MAX_M)
      if (lot.frontage === 'avenue') expect([lot.width, lot.depth]).toEqual([8, 5])
      else expect([lot.width, lot.depth]).toEqual([8, 8])
    }
  })

  it('gives every lot the zone of its block', () => {
    for (const lot of sites) {
      const block = blockOfCell(cellOf(lot).column, cellOf(lot).row)
      expect(lot.zone).toBe(zoneOfBlock(block.column, block.row))
      expect(lot.blockId).toBe(`block:${block.column}:${block.row}`)
    }
    expect(new Set(sites.map((lot) => lot.zone))).toEqual(new Set(TOWN_DISTRICTS))
  })

  it('draws every zone border on a collector, the avenue or the boulevard', () => {
    let borders = 0
    for (const lot of sites) {
      const { column, row } = cellOf(lot)
      const east = byCell.get(`${column + 1}:${row}`)
      const south = byCell.get(`${column}:${row + 1}`)
      if (east && east.zone !== lot.zone) {
        borders++
        expect(Math.abs(((column + 1) * LOT_PITCH_M) % BLOCK_PITCH_M)).toBe(0)
      }
      if (south && south.zone !== lot.zone) {
        borders++
        expect(Math.abs(((row + 1) * LOT_PITCH_M) % BLOCK_PITCH_M)).toBe(0)
      }
    }
    expect(borders).toBeGreaterThan(0)
    // The campus is the one zone the lattice does not bound: the boulevard does.
    for (const lot of firstRing) expect(['boulevard', 'avenue']).toContain(lot.frontage)
  })

  it('fronts every lot on the grandest road beside it, with its door on that kerb', () => {
    const rank = { avenue: 3, boulevard: 2, collector: 1, lane: 0 }
    for (const lot of sites) {
      const normal = SIDE_NORMAL[lot.facing]
      const kerb = ROAD_WIDTH_M[lot.frontage] / 2 - SIDEWALK_M[lot.frontage]
      const fronted = roads.filter((road) => {
        const isAlongX = road.from.z === road.to.z
        if (road.class !== lot.frontage || isAlongX !== (normal.x === 0)) return false
        const off = isAlongX ? road.from.z - lot.door.z : road.from.x - lot.door.x
        const outward = isAlongX ? normal.z : normal.x
        // The road's centre lies beyond the door, on the side the lot faces.
        return Math.abs(off * outward - kerb) < 1e-9
      })
      expect(fronted.length).toBeGreaterThan(0)
      // The door is straight out from the middle of the front.
      expect(normal.x === 0 ? lot.door.x : lot.door.z).toBe(normal.x === 0 ? lot.x : lot.z)
      const out = (lot.door.x - lot.x) * normal.x + (lot.door.z - lot.z) * normal.z
      expect(out).toBeGreaterThanOrEqual((normal.x === 0 ? lot.depth : lot.width) / 2)
      const beside = roads.filter((road) => gap(lot, roadStrip(road)) < 1.01)
      expect(rank[lot.frontage]).toBe(Math.max(...beside.map((road) => rank[road.class])))
    }
  })

  it('boxes every park block round its own lots, and nothing else', () => {
    const parks = parkPromenades(sites)
    const parkBlocks = new Set(sites.filter((lot) => lot.zone === 'park').map((lot) => lot.blockId))
    expect(parks.map((park) => park.parkBlockId).sort()).toEqual([...parkBlocks].sort())
    for (const lot of sites)
      for (const park of parks)
        expect(overlapping(lot, park)).toBe(lot.blockId === park.parkBlockId)
  })
})
