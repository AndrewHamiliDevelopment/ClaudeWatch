import { useMemo, type ReactNode } from 'react'
import { FURNITURE_SCALE, GUEST_FURNITURE_SCALE } from '../../../shared/office/figure-scale'
import type { ThemeZoneGroup } from '../logic/office-themes'
import type { WallsMode } from '../logic/room-layout'
import { plateLocalFloor } from '../logic/zone-framing'
import type { FloorGeometry, LoungeGeometry } from '../scene-model'
import { getTheme } from '../themes/registry'
import type { OfficeTheme } from '../themes/types'

// Themes model furniture for agents at their old size. Drawing it in a group scaled about a
// fixed point enlarges it for today's agents without moving that point or touching a theme.
function scaledAbout(
  point: { x: number; z: number },
  scale: number,
  key: string,
  furniture: ReactNode
) {
  return (
    <group key={key} position={[point.x, 0, point.z]} scale={scale}>
      <group position={[-point.x, 0, -point.z]}>{furniture}</group>
    </group>
  )
}

// The sim's lounge shrunk about its centre to the size its theme draws. Drawn in a group scaled
// back up about that centre, every stool lands on one of the sim's seats.
export function loungeAsDrawn(lounge: LoungeGeometry): LoungeGeometry {
  const shrunk = (point: { x: number; z: number }) => ({
    x: lounge.x + (point.x - lounge.x) / FURNITURE_SCALE,
    z: lounge.z + (point.z - lounge.z) / FURNITURE_SCALE
  })
  return {
    ...lounge,
    width: lounge.width / FURNITURE_SCALE,
    depth: lounge.depth / FURNITURE_SCALE,
    door: shrunk(lounge.door),
    seats: lounge.seats.map((seat) => ({ ...seat, ...shrunk(seat) }))
  }
}

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
  // The scene re-renders for every step an agent takes; nothing here changes then, and handing
  // React the same elements lets it skip the whole floor.
  return useMemo(
    () => (
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
                  {kit.Lounge &&
                    company.lounge &&
                    scaledAbout(
                      company.lounge,
                      FURNITURE_SCALE,
                      company.lounge.id,
                      <kit.Lounge lounge={loungeAsDrawn(company.lounge)} />
                    )}
                </group>
              ))}
              {zoneGroup.projects.map((project) => (
                <kit.ProjectOffice key={project.id} zone={project} />
              ))}
              <kit.RoomFloors rooms={zoneGroup.rooms} />
              <kit.Walls
                rooms={zoneGroup.rooms}
                mode={wallsMode}
                isReducedMotion={isReducedMotion}
              />
              {zoneGroup.rooms.map((room) => (
                <group key={room.id}>
                  <kit.Doorway room={room} />
                  <kit.RoomSign room={room} />
                  <kit.RoomDressing room={room} />
                  {room.seats.map((slot) =>
                    // The seat is the sim's and stays put; a lead's desk grows more than a guest's.
                    scaledAbout(
                      slot,
                      slot.slotId === 'desk_main' ? FURNITURE_SCALE : GUEST_FURNITURE_SCALE,
                      slot.slotId,
                      <kit.Desk room={room} slot={slot} />
                    )
                  )}
                </group>
              ))}
            </group>
          )
        })}
      </group>
    ),
    [floor, plate, Slab, Elevator, zoneGroups, wallsMode, isReducedMotion]
  )
}
