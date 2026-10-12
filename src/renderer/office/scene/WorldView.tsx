import { useMemo } from 'react'
import type { ZoomBand } from '../logic/camera-bands'
import type { ThemeZoneGroup } from '../logic/office-themes'
import { plateLocalFloor } from '../logic/zone-framing'
import type { FloorGeometry } from '../scene-model'
import { towerStand } from '../themes/apron'
import { getTheme } from '../themes/registry'
import { officesOf, type Lot } from '../themes/surroundings'
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
  // The district draws around its own origin: it goes at the plate centre, measured from there.
  const plate = useMemo(() => plateLocalFloor(floor), [floor])
  const tower = towerStand(plate)
  // Apron lots are limited by the offices they must not hide, so where those stand counts too.
  const offices = officesOf(plate).map(({ x, z, width, depth }) => [x, z, width, depth])
  const placed = [floor.x, floor.z, floor.width, floor.depth]
  const revision = JSON.stringify([theme.id, hasTower, placed, offices, floors])
  return (
    <BatchedScene revision={revision} isStatic>
      <group position={[floor.x, 0, floor.z]}>
        <District floor={plate} />
        <Hangar floor={plate} />
        {hasTower && (
          <group position={[tower.x, 0, tower.z]}>
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
  // The buildings are placed once; only the few moving things are followed frame by frame.
  return (
    <>
      <BatchedScene revision={revision} isStatic>
        {drawn.map(({ themeId, lots: themeLots }) => {
          const { Surroundings } = getTheme(themeId).kit.zone
          return Surroundings && <Surroundings key={themeId} floor={floor} lots={themeLots} />
        })}
      </BatchedScene>
      <BatchedScene revision={revision}>
        {drawn.map(({ themeId, lots: themeLots }) => {
          const { Ambient } = getTheme(themeId).kit.zone
          return (
            Ambient && (
              <Ambient
                key={themeId}
                floor={floor}
                lots={themeLots}
                isReducedMotion={isReducedMotion}
              />
            )
          )
        })}
      </BatchedScene>
    </>
  )
}
