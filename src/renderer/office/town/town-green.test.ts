import { describe, expect, it } from 'vitest'
import type { ZoneGeometry } from '../scene-model'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import { hashOf } from '../themes/lot-math'
import { campusClaim, neededClaim } from './town-claim'
import { campusGreen } from './town-green'
import { GREEN_PITCH_M, ROAD_WIDTH_M } from './town-grid'
import { townBlocks } from './town-plan'
import { ZONE_HEIGHT_CAP_M } from './town-zones'
import { edges, gap, overlapping, widened } from './town.test-utils'

const HEIGHT_PER_METRE = 0.7
const PLOT_SIDE_M = 4

function everyZone(zones: readonly ZoneGeometry[]): ZoneGeometry[] {
  return zones.flatMap((zone) => [zone, ...everyZone(zone.children)])
}

describe.each(LIVE_FLOORS)('campusGreen: %s', (_name, floor) => {
  const plan = townBlocks(campusClaim(neededClaim(floor), null), 'full')
  const plots = campusGreen(floor, plan)
  const zones = everyZone(floor.zones)
  const companies = floor.zones.filter((zone) => zone.kind === 'company')

  it('plants the belt and the bare plate', () => {
    expect(plots.filter((plot) => !overlapping(plot, floor)).length).toBeGreaterThan(8)
  })

  it('names every plot after its 6 m cell and seeds it from that name', () => {
    expect(new Set(plots.map((plot) => plot.id)).size).toBe(plots.length)
    for (const plot of plots) {
      const [, column, row] = plot.id.split(':').map(Number)
      expect(plot.id).toBe(`green:${column}:${row}`)
      expect(plot.seed).toBe(hashOf(plot.id))
      expect(plot).toMatchObject({
        x: (column + 0.5) * GREEN_PITCH_M,
        z: (row + 0.5) * GREEN_PITCH_M,
        width: PLOT_SIDE_M,
        depth: PLOT_SIDE_M
      })
    }
  })

  it('keeps every plot inside the boulevard and off the campus street', () => {
    const claim = edges(plan.claim)
    for (const plot of plots) {
      expect(edges(plot).west).toBeGreaterThanOrEqual(claim.west + ROAD_WIDTH_M.boulevard)
      expect(edges(plot).east).toBeLessThanOrEqual(claim.east - ROAD_WIDTH_M.boulevard)
      expect(edges(plot).north).toBeGreaterThanOrEqual(claim.north + ROAD_WIDTH_M.boulevard)
      expect(edges(plot).south).toBeLessThanOrEqual(claim.south - ROAD_WIDTH_M.boulevard)
      expect(Math.abs(plot.z) - plot.depth / 2).toBeGreaterThanOrEqual(ROAD_WIDTH_M.avenue / 2)
    }
  })

  it('keeps every plot off the companies, their offices and rooms, and whole on or off the plate', () => {
    for (const plot of plots) {
      for (const solid of [...zones, ...floor.rooms]) expect(overlapping(plot, solid)).toBe(false)
      const isOnPlate = overlapping(plot, floor)
      if (isOnPlate) {
        expect(edges(plot).west).toBeGreaterThanOrEqual(edges(floor).west)
        expect(edges(plot).east).toBeLessThanOrEqual(edges(floor).east)
        expect(edges(plot).north).toBeGreaterThanOrEqual(edges(floor).north)
        expect(edges(plot).south).toBeLessThanOrEqual(edges(floor).south)
      }
    }
  })

  it('holds every plot under the offices, the promenades and the park cap', () => {
    const projects = zones.filter((zone) => zone.kind === 'project')
    expect(projects.length).toBeGreaterThan(0)
    for (const plot of plots) {
      expect(plot.maxHeight).toBeLessThanOrEqual(ZONE_HEIGHT_CAP_M.park)
      for (const hidden of [...projects, ...plan.promenades])
        expect(plot.maxHeight).toBeLessThanOrEqual(gap(plot, hidden) * HEIGHT_PER_METRE + 1e-9)
      expect(plot.maxHeight).toBeGreaterThanOrEqual(0.4)
      expect(plot.kind).toBe(plot.maxHeight >= 2 ? 'building' : 'prop')
    }
  })

  it('makes every plot a park of the nearest company, facing out to the boulevard', () => {
    const claim = edges(plan.claim)
    for (const plot of plots) {
      expect(plot).toMatchObject({ zone: 'park', isLandmark: false })
      const nearest = Math.min(...companies.map((zone) => gap(plot, zone)))
      const tied = companies.filter((zone) => gap(plot, zone) === nearest).map((zone) => zone.id)
      expect(plot.zoneId).toBe([...tied].sort()[0])
      const toEdge = {
        north: plot.z - claim.north,
        east: claim.east - plot.x,
        south: claim.south - plot.z,
        west: plot.x - claim.west
      }
      expect(toEdge[plot.facing]).toBe(Math.min(...Object.values(toEdge)))
    }
  })

  it('is the same green for the same floor', () => {
    expect(campusGreen(floor, plan)).toEqual(plots)
  })

  it('moves no plot when a desk column arrives: plots go or stay, each in its cell', () => {
    const grown = widened(floor, 5)
    const after = campusGreen(
      grown,
      townBlocks(campusClaim(neededClaim(grown), plan.claim), 'full')
    )
    const was = new Map(plots.map((plot) => [plot.id, plot]))
    const kept = after.filter((plot) => was.has(plot.id))
    expect(kept.length).toBeGreaterThan(plots.length / 2)
    for (const plot of kept) {
      const { x, z, width, depth, seed } = was.get(plot.id) ?? plot
      expect(plot).toMatchObject({ x, z, width, depth, seed })
    }
  })
})
