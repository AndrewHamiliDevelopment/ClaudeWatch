import { useMemo } from 'react'
import type { ZoomBand } from '../logic/camera-bands'
import type { ThemeZoneGroup } from '../logic/office-themes'
import { plateCentre, plateLocalFloor } from '../logic/zone-framing'
import type { FloorGeometry } from '../scene-model'
import { getTheme } from '../themes/registry'
import type { Lot } from '../themes/surroundings'
import type { OfficeTheme, TowerFloor } from '../themes/types'
import { BatchedScene } from './BatchedScene'

// Merged like the floor: the skyline is the largest fixed cost in the draw budget.
export function WorldView({
  floor,
  theme,
  floors,
  band
}: {
  floor: FloorGeometry
  theme: OfficeTheme
  floors: readonly TowerFloor[]
  band: ZoomBand
}) {
  const { District, Hangar, Tower } = theme.world
  const hasTower = band === 'building'
  // The district draws around its own origin from the plate's size: it goes at the plate centre.
  const centre = plateCentre(floor)
  const plate = plateLocalFloor(floor)
  const revision = JSON.stringify([theme.id, hasTower, floor.width, floor.depth, centre, floors])
  return (
    <BatchedScene revision={revision}>
      <group position={[centre.x, 0, centre.z]}>
        <District floor={plate} />
        <Hangar floor={plate} />
        {hasTower && (
          <group position={[floor.width / 2 + 7, 0, -floor.depth / 2 - 8]}>
            <Tower floors={floors} />
          </group>
        )}
      </group>
    </BatchedScene>
  )
}

interface ThemeLots {
  themeId: string
  lots: Lot[]
}

// A company's lots go to the theme that company resolved to; the far ring goes to the floor's.
export function lotsByTheme(
  lots: readonly Lot[],
  zoneGroups: readonly ThemeZoneGroup[],
  floorThemeId: string
): ThemeLots[] {
  const themeIdByCompany = new Map(
    zoneGroups.flatMap(({ themeId, companies }) =>
      companies.map((company) => [company.id, themeId] as const)
    )
  )
  const groups = new Map<string, Lot[]>()
  for (const lot of lots) {
    const owner = lot.zoneId === null ? undefined : themeIdByCompany.get(lot.zoneId)
    const themeId = owner ?? floorThemeId
    const group = groups.get(themeId)
    if (group) group.push(lot)
    else groups.set(themeId, [lot])
  }
  return [...groups].map(([themeId, themeLots]) => ({ themeId, lots: themeLots }))
}

// The filled world around the offices. Merged apart from the district, so zooming in and out of
// the building view (which rebuilds that one) never rebuilds this.
export function SurroundingsView({
  floor,
  floorTheme,
  zoneGroups,
  lots,
  isReducedMotion
}: {
  floor: FloorGeometry
  floorTheme: OfficeTheme
  zoneGroups: readonly ThemeZoneGroup[]
  lots: readonly Lot[]
  isReducedMotion: boolean
}) {
  const drawn = useMemo(
    () =>
      lotsByTheme(lots, zoneGroups, floorTheme.id).filter(({ themeId }) => {
        const { Surroundings, Ambient } = getTheme(themeId).kit.zone
        return Surroundings !== undefined || Ambient !== undefined
      }),
    [lots, zoneGroups, floorTheme.id]
  )
  const revision = useMemo(() => JSON.stringify([drawn, isReducedMotion]), [drawn, isReducedMotion])
  // No theme here draws surroundings: no batch, and nothing to update each frame.
  if (drawn.length === 0) return null
  return (
    <BatchedScene revision={revision}>
      {drawn.map(({ themeId, lots: themeLots }) => {
        const { Surroundings, Ambient } = getTheme(themeId).kit.zone
        return (
          <group key={themeId}>
            {Surroundings && <Surroundings floor={floor} lots={themeLots} />}
            {Ambient && (
              <Ambient floor={floor} lots={themeLots} isReducedMotion={isReducedMotion} />
            )}
          </group>
        )
      })}
    </BatchedScene>
  )
}
