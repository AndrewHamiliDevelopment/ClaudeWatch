import { plateCentre, plateLocalFloor } from '../logic/zone-framing'
import type { FloorGeometry } from '../scene-model'
import { apronLots, HANGAR, TOWER } from '../themes/apron'
import {
  apronLots as garrisonLots,
  apronReserved as garrisonStands
} from '../themes/orbital-garrison/apron'
import { ORBITAL_GARRISON_ID } from '../themes/orbital-garrison/roster'
import { QUIET_GROVE_ID } from '../themes/quiet-grove/roster'
import type { Lot } from '../themes/surroundings'
import { apronLots as courtLots, hangarStand, towerStand } from '../themes/violet-court/apron'
import { VIOLET_COURT_ID } from '../themes/violet-court/roster'

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>

// A landmark with no lot of its own (a hangar, a tower): solid ground all the same.
function stand(id: string, rect: Rect): Lot {
  return { id: `stand:${id}`, kind: 'building', ...rect, maxHeight: 0, seed: 0, zoneId: null }
}

function sharedDistrict(plate: FloorGeometry): Lot[] {
  const east = plate.width / 2
  return [
    ...apronLots(plate),
    stand('hangar', { x: east + HANGAR.offsetX, z: 0, width: HANGAR.width, depth: HANGAR.depth }),
    stand('tower', {
      x: east + TOWER.offsetX,
      z: -plate.depth / 2 - TOWER.offsetZ,
      width: TOWER.side,
      depth: TOWER.side
    })
  ]
}

function courtDistrict(plate: FloorGeometry): Lot[] {
  return [
    ...courtLots(plate),
    stand('hangar', hangarStand(plate)),
    stand('tower', towerStand(plate))
  ]
}

const DISTRICTS: Record<string, ((plate: FloorGeometry) => Lot[]) | undefined> = {
  [ORBITAL_GARRISON_ID]: (plate) => [
    ...garrisonLots(plate),
    ...garrisonStands(plate).map((rect, index) => stand(String(index), rect))
  ],
  [VIOLET_COURT_ID]: courtDistrict,
  // The grove fills its apron from the court's lot grid.
  [QUIET_GROVE_ID]: courtDistrict
}

// What the floor theme stands on the apron, where the player and the streets must go round it.
// Each theme lays its district out around the plate's own centre; these are moved to the floor's.
export function districtLots(themeId: string, floor: FloorGeometry): Lot[] {
  const centre = plateCentre(floor)
  const district = DISTRICTS[themeId] ?? sharedDistrict
  return district(plateLocalFloor(floor)).map((lot) => ({
    ...lot,
    id: `district:${lot.id}`,
    x: lot.x + centre.x,
    z: lot.z + centre.z
  }))
}
