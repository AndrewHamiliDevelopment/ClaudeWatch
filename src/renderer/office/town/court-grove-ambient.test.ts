import { describe, expect, it } from 'vitest'
import { LIVE_FLOORS } from '../themes/floors.test-utils'
import { QUIET_GROVE_ID } from '../themes/quiet-grove/roster'
import { fireflyMovers, leafMovers } from '../themes/quiet-grove/GroveSurroundings'
import { VIOLET_COURT_ID } from '../themes/violet-court/roster'
import { bannerMasts, patrolOrbits } from '../themes/violet-court/CourtSurroundings'
import { drawnTown } from './drawn-town.test-utils'
import { drawnTop } from './town-ambient'

// Movers that hover or circle over a lot keep above what the town drew there, and under its limit.
describe.each(LIVE_FLOORS)('the court and grove movers on %s', (_label, floor) => {
  const court = drawnTown(VIOLET_COURT_ID, floor)
  const grove = drawnTown(QUIET_GROVE_ID, floor)
  const topOf = (lots: typeof court) => new Map(lots.map((each) => [each.lot.id, each]))

  it('stands each banner mast on the roof drawn, within the lot’s limit', () => {
    const masts = bannerMasts(court)
    expect(masts.length).toBeGreaterThan(0)
    for (const mast of masts) {
      const placed = topOf(court).get(mast.id)!
      expect(mast.foot[1]).toBeCloseTo(drawnTop(placed))
      expect(mast.foot[1] + mast.height).toBeLessThanOrEqual(placed.lot.maxHeight + 1e-9)
    }
  })

  it('flies each patrol skiff clear above the roof it circles', () => {
    const orbits = patrolOrbits(court)
    expect(orbits.length).toBeGreaterThan(0)
    for (const orbit of orbits) {
      expect(orbit.y).toBeGreaterThan(drawnTop(topOf(court).get(orbit.lot.id)!) + 0.5)
      expect(orbit.y).toBeLessThanOrEqual(orbit.lot.maxHeight)
    }
  })

  it('keeps fireflies over the roofs and leaves landing on them, never inside a building', () => {
    for (const mover of [...fireflyMovers(grove), ...leafMovers(grove)]) {
      const top = drawnTop(topOf(grove).get(mover.id)!)
      expect(mover.home[1] - mover.fall).toBeGreaterThanOrEqual(top - 1e-9)
      expect(mover.home[1]).toBeLessThanOrEqual(topOf(grove).get(mover.id)!.lot.maxHeight)
    }
    expect(fireflyMovers(grove).length).toBeGreaterThan(0)
  })
})
