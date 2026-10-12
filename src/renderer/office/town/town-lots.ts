import type { QualityLevel } from '../logic/quality'
import { boundsOfZone } from '../logic/zone-framing'
import { contains, gapBetween, grow, type Rect } from '../themes/lot-math'
import { HEIGHT_PER_METRE, MIN_LOT_HEIGHT_M, capped, type Lot } from '../themes/surroundings'
import { BUILDING_CAP, FAR_RING_FROM_M, MIN_BELT_M } from './town-grid'
import type { LotSite, Promenade } from './town-sites'
import { TOWN_DISTRICTS, zoneHeightCap } from './town-zones'

// A Lot (themes/surroundings.ts) with a place in the plan. `zoneId` is the owning company, which
// the plan does not know: it is null here, and `lotOwners` names the owners.
export interface TownLot extends Lot, LotSite {
  isFarRing: boolean
  isLandmark: boolean
}

// One to a zone. The old town comes first so that it never changes while the campus grows.
function landmarkIds(lots: readonly TownLot[], oldTownEast: number): Set<string> {
  const isNewTown = (lot: TownLot): number => Number(lot.x >= oldTownEast)
  return new Set(
    TOWN_DISTRICTS.flatMap((zone) => {
      const buildings = lots.filter((lot) => lot.zone === zone && lot.kind === 'building')
      const most = Math.max(...buildings.map((lot) => lot.maxHeight))
      // The plan knows no theme, so the landmark takes the most room its zone has to give.
      const [landmark] = buildings
        .filter((lot) => lot.maxHeight === most)
        .sort((a, b) => isNewTown(a) - isNewTown(b) || a.seed - b.seed)
      return landmark ? [landmark.id] : []
    })
  )
}

// Sites with a height limit, less the ones too low to build on and the ones over the cap.
export function townLots(
  sites: readonly LotSite[],
  claim: Rect,
  promenades: readonly Promenade[],
  detail: QualityLevel
): TownLot[] {
  const envelope = grow(claim, -MIN_BELT_M)
  const near = grow(claim, FAR_RING_FROM_M)
  const standing = sites.flatMap((site): TownLot[] => {
    const others = promenades.filter((walk) => walk.parkBlockId !== site.blockId)
    const clear = Math.min(gapBetween(site, envelope), ...others.map((w) => gapBetween(site, w)))
    const isFarRing = !contains(near, site)
    const maxHeight = Math.min(zoneHeightCap(site.zone, isFarRing), clear * HEIGHT_PER_METRE)
    if (maxHeight < MIN_LOT_HEIGHT_M.prop) return []
    // At balanced every other far-ring lot goes first, in a checkerboard, so no side empties.
    if (detail === 'balanced' && isFarRing && (site.column + site.row) % 2 !== 0) return []
    const kind = maxHeight < MIN_LOT_HEIGHT_M.building ? 'prop' : 'building'
    return [{ ...site, kind, maxHeight, zoneId: null, isFarRing, isLandmark: false }]
  })
  const oldTownEast = boundsOfZone(claim).minX
  const buildings = standing.filter((lot) => lot.kind === 'building')
  // Over the cap the ring outside the old town thins first, by seed: the old town stays put.
  const isOuterRing = (lot: TownLot): boolean => lot.isFarRing && lot.x >= oldTownEast
  const settled = buildings.filter((lot) => !isOuterRing(lot))
  const limit = BUILDING_CAP[detail]
  const kept = new Set(
    (settled.length > limit
      ? capped(settled, limit, near)
      : [...settled, ...capped(buildings.filter(isOuterRing), limit - settled.length, claim)]
    ).map((lot) => lot.id)
  )
  const lots = standing.filter((lot) => lot.kind === 'prop' || kept.has(lot.id))
  const landmarks = landmarkIds(lots, oldTownEast)
  return lots.map((lot) => (landmarks.has(lot.id) ? { ...lot, isLandmark: true } : lot))
}
