import { useMemo } from 'react'
import type { ThemeZoneGroup } from '../logic/office-themes'
import type { WallsMode } from '../logic/room-layout'
import { plateLocalFloor } from '../logic/zone-framing'
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
  // The slab and the lift draw around their own origin: they go at the plate centre, with the
  // floor measured from there. Zones are in the sim's coordinates and stay outside the group.
  const plate = useMemo(() => plateLocalFloor(floor), [floor])
  return (
    <group>
      <group position={[floor.x, 0, floor.z]}>
        <Slab floor={plate} />
        <Elevator floor={plate} />
      </group>
      {zoneGroups.map((zoneGroup) => {
        const kit = getTheme(zoneGroup.themeId).kit.zone
        return (
          <group key={zoneGroup.themeId}>
            {zoneGroup.companies.map((company) => (
              <group key={company.id}>
                <kit.CompanyZone zone={company} />
                {kit.Lounge && company.lounge && <kit.Lounge lounge={company.lounge} />}
              </group>
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
    </group>
  )
}
