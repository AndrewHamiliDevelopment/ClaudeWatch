import type { WallSide } from '../logic/room-layout'
import { boundsOfZone } from '../logic/zone-framing'
import type { FloorGeometry } from '../scene-model'
import { contains, gapBetween, grow, hashOf, overlaps, type Rect } from '../themes/lot-math'
import {
  HEIGHT_PER_METRE,
  LANE_M,
  MIN_LOT_HEIGHT_M,
  heightLimit,
  surveySite,
  type Lot
} from '../themes/surroundings'
import { GREEN_PITCH_M, ROAD_WIDTH_M, cellRect } from './town-grid'
import { nearestCompany, type TownPlan } from './town-plan'
import { ZONE_HEIGHT_CAP_M } from './town-zones'

// A park plot of the campus: on the belt between the plate and the boulevard, or on bare plate.
export interface GreenPlot extends Lot {
  zone: 'park'
  facing: WallSide
  isLandmark: false
}

// Left bare round each plot, so plots read as beds and not as one hedge.
const PLOT_MARGIN_M = 1

// A plot looks out at the boulevard: the side of the claim it is nearest.
function facingOut(plot: Rect, claim: Rect): WallSide {
  const { minX, maxX, minZ, maxZ } = boundsOfZone(claim)
  const toEdge: readonly (readonly [WallSide, number])[] = [
    ['north', plot.z - minZ],
    ['east', maxX - plot.x],
    ['south', maxZ - plot.z],
    ['west', plot.x - minX]
  ]
  return toEdge.reduce((nearest, side) => (side[1] < nearest[1] ? side : nearest))[0]
}

// Park plots on the 6 m lattice inside the claim. They hang on the gate like the town's lots, so
// a plot is the same plot for as long as its cell is clear. Runs on every floor change.
export function campusGreen(floor: FloorGeometry, plan: TownPlan): GreenPlot[] {
  const site = surveySite(floor)
  const claim = boundsOfZone(plan.claim)
  const insideBoulevard = grow(plan.claim, -ROAD_WIDTH_M.boulevard)
  // The avenue's width carried through the claim: the way from the plaza to the gate and on east.
  const campusStreet: Rect = { ...plan.claim, z: 0, depth: ROAD_WIDTH_M.avenue }
  const plots: GreenPlot[] = []
  for (let column = claim.minX / GREEN_PITCH_M; column < claim.maxX / GREEN_PITCH_M; column++)
    for (let row = claim.minZ / GREEN_PITCH_M; row < claim.maxZ / GREEN_PITCH_M; row++) {
      const plot = grow(cellRect(column, row, GREEN_PITCH_M), -PLOT_MARGIN_M)
      if (!contains(insideBoulevard, plot) || overlaps(plot, campusStreet)) continue
      const isOnBelt = !overlaps(plot, site.plate)
      const isOnBarePlate =
        contains(site.plate, plot) &&
        !site.blocked.some((solid) => overlaps(plot, solid)) &&
        !site.companies.some((zone) => gapBetween(plot, zone) < LANE_M)
      if (!isOnBelt && !isOnBarePlate) continue
      const clear = Math.min(...plan.promenades.map((walk) => gapBetween(plot, walk)))
      const maxHeight = Math.min(
        ZONE_HEIGHT_CAP_M.park,
        heightLimit(plot, site.offices),
        clear * HEIGHT_PER_METRE
      )
      if (maxHeight < MIN_LOT_HEIGHT_M.prop) continue
      const id = `green:${column}:${row}`
      plots.push({
        id,
        kind: maxHeight < MIN_LOT_HEIGHT_M.building ? 'prop' : 'building',
        ...plot,
        maxHeight,
        seed: hashOf(id),
        zoneId: nearestCompany(plot, site.companies)?.id ?? null,
        zone: 'park',
        facing: facingOut(plot, plan.claim),
        isLandmark: false
      })
    }
  return plots
}
