import type { PlacedLot } from '../themes/lot-kit'
import { getTheme } from '../themes/registry'
import type { FloorGeometry } from '../scene-model'
import { GROUND_Y } from '../themes/surroundings'
import { dressLot, type TownDress } from './town-dress'
import { townLandmark } from './TownView'
import { townOf } from './use-town-plan'

export function townDressOf(themeId: string): TownDress {
  const dress = getTheme(themeId).town
  if (!dress) throw new Error(`${themeId} has no town`)
  return dress
}

// Every lot of a first start's town at full detail, as TownView draws it in one theme.
export function drawnTown(themeId: string, floor: FloorGeometry): PlacedLot[] {
  const { plan } = townOf(floor, null, 'full')
  const landmark = townLandmark(plan)
  return plan.lots
    .filter((lot) => lot !== landmark)
    .map((lot) => dressLot(lot, GROUND_Y, townDressOf(themeId)))
}
