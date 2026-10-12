import type { ZoneDesign } from '../../town/town-dress'
import { draw } from '../lot-math'
import { BUILDING_SIDE_M, BUILDINGS } from './buildings'
import { GARRISON } from './palette'
import { scaled } from './placed'
import {
  canteenDome,
  commissaryRow,
  dutyOffice,
  holoArena,
  recHall,
  supplyDepot
} from './town-halls'
import { fleetHangar, habitatPods, hydroponicBed, officersRow, paradeLawn } from './town-quarters'

// The draw the yard has always taken a design's proportions from (lots.ts).
const SHARE_DRAW = 7

// A yard design is drawn on a 6 m pad to a height limit: scaled to the plot, it is a zone design.
function fromYard(id: string): ZoneDesign['build'] {
  const yard = BUILDINGS.find((design) => design.id === id)
  if (!yard) throw new Error(`The garrison yard has no design called ${id}`)
  return (plot) => {
    const scale = Math.min(plot.width, plot.depth) / BUILDING_SIDE_M
    const parts = scaled(yard.build(plot.height / scale, draw(plot.seed, SHARE_DRAW)), scale)
    // White is the yard's trim (roofs, tanks, aerials): the zone's accent takes its place.
    return parts.map((part) =>
      part.color === GARRISON.white ? { ...part, color: plot.accent } : part
    )
  }
}

const design = (
  name: string,
  zones: ZoneDesign['zones'],
  min: number,
  max: number,
  build: ZoneDesign['build']
): ZoneDesign => ({ name, zones, height: { min, max }, build })

const landmark = (...args: Parameters<typeof design>): ZoneDesign => ({
  ...design(...args),
  isLandmark: true
})

// Heights are for an 8 m plot, where a yard design is drawn a third larger than on its pad.
export const GARRISON_DESIGNS: readonly ZoneDesign[] = [
  landmark('control-tower', ['civic'], 8, 16, fromYard('control-tower')),
  // A relay mast needs 12 m, more than a civic lot by the avenue has: it stands among the
  // workshops of the far ring too.
  design('comms-tower', ['civic', 'workshop'], 12, 24, fromYard('comms-tower')),
  design('radar-tower', ['civic'], 5.4, 10, fromYard('radar-tower')),
  design('duty-office', ['civic'], 2, 4, dutyOffice),
  design('commissary-row', ['market'], 2, 4, commissaryRow),
  design('supply-depot', ['market'], 3, 7, supplyDepot),
  landmark('canteen-dome', ['entertainment'], 6, 12, canteenDome),
  design('holo-arena', ['entertainment'], 2, 5, holoArena),
  design('rec-hall', ['entertainment'], 3, 8, recHall),
  design('barracks-block', ['residential'], 2.5, 8, fromYard('barracks')),
  design('habitat-pods', ['residential'], 2.5, 9, habitatPods),
  design('officers-row', ['residential'], 2, 5, officersRow),
  landmark('fleet-hangar', ['workshop'], 7, 16, fleetHangar),
  design('maintenance-shed', ['workshop'], 2.5, 6, fromYard('hangar')),
  design('tank-farm', ['workshop'], 2.5, 5.5, fromYard('tank-farm')),
  design('frame-pad', ['workshop'], 2.5, 7.5, fromYard('frame-pad')),
  design('hydroponic-bed', ['park'], 2, 4, hydroponicBed),
  design('parade-lawn', ['park'], 2, 5, paradeLawn)
]
