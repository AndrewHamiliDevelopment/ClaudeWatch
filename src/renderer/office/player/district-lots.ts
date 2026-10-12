import type { FloorGeometry } from '../scene-model'
import { apronLots, hangarStand, towerStand } from '../themes/apron'
import { DISTRICT_SIDES, HANGAR_SIDES, terraceLots } from '../themes/LotFill'
import { colonyStand, padLots } from '../themes/orbital-garrison/apron'
import { ORBITAL_GARRISON_ID } from '../themes/orbital-garrison/roster'
import { QUIET_GROVE_ID } from '../themes/quiet-grove/roster'
import type { Lot } from '../themes/surroundings'
import { TOWN_APRON } from '../themes/town-apron'
import { VIOLET_COURT_ID } from '../themes/violet-court/roster'

type Rect = Pick<Lot, 'x' | 'z' | 'width' | 'depth'>

// A landmark with no lot of its own (a hangar, a tower): solid ground all the same.
function stand(id: string, rect: Rect): Lot {
  return { id: `stand:${id}`, kind: 'building', ...rect, maxHeight: 0, seed: 0, zoneId: null }
}

// The court and the grove fill every side of the apron with terraces, district and hangar alike.
const terraces = (floor: FloorGeometry): Lot[] =>
  terraceLots(floor, [...DISTRICT_SIDES, ...HANGAR_SIDES])

const DISTRICTS: Record<string, ((floor: FloorGeometry) => Lot[]) | undefined> = {
  [ORBITAL_GARRISON_ID]: (floor) => [...padLots(floor), stand('colony', colonyStand(floor))],
  [VIOLET_COURT_ID]: terraces,
  [QUIET_GROVE_ID]: terraces
}

// What the floor theme stands on the apron, where the player and the streets must go round it.
// The apron placer works in whatever frame the floor is in, so these come out in the floor's own.
export function districtLots(themeId: string, floor: FloorGeometry): Lot[] {
  const lots = (DISTRICTS[themeId] ?? ((plate) => apronLots(plate, TOWN_APRON)))(floor)
  return [
    ...lots.map((lot) => ({ ...lot, id: `district:${lot.id}` })),
    stand('hangar', hangarStand(floor)),
    stand('tower', towerStand(floor))
  ]
}
