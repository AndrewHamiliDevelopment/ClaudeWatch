import type { ThemeZoneGroup } from '../logic/office-themes'
import type { WallsMode } from '../logic/room-layout'
import type { FloorGeometry } from '../scene-model'
import { getTheme } from '../themes/registry'
import type { OfficeTheme } from '../themes/types'

// One slab and one lift from the floor's theme; every zone is drawn by the theme it resolved to.
export function FloorView({
  floor,
  floorTheme,
  zoneGroups,
  wallsMode,
  isReducedMotion
}: {
  floor: FloorGeometry
  floorTheme: OfficeTheme
  zoneGroups: readonly ThemeZoneGroup[]
  wallsMode: WallsMode
  isReducedMotion: boolean
}) {
  const { Slab, Elevator } = floorTheme.kit.floor
  return (
    <group>
      <Slab floor={floor} />
      {zoneGroups.map((zoneGroup) => {
        const kit = getTheme(zoneGroup.themeId).kit.zone
        return (
          <group key={zoneGroup.themeId}>
            {zoneGroup.companies.map((company) => (
              <kit.CompanyZone key={company.id} zone={company} />
            ))}
            {zoneGroup.projects.map((project) => (
              <kit.ProjectOffice key={project.id} zone={project} />
            ))}
            <kit.RoomFloors rooms={zoneGroup.rooms} />
            <kit.Walls rooms={zoneGroup.rooms} mode={wallsMode} isReducedMotion={isReducedMotion} />
            {zoneGroup.rooms.map((room) => (
              <group key={room.id}>
                <kit.Doorway room={room} />
                <kit.RoomSign room={room} />
                <kit.RoomDressing room={room} />
                {room.seats.map((slot) => (
                  <kit.Desk key={slot.slotId} room={room} slot={slot} />
                ))}
              </group>
            ))}
          </group>
        )
      })}
      <Elevator floor={floor} />
    </group>
  )
}
