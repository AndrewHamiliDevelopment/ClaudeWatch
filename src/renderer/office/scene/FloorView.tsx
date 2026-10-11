import type { WallsMode } from '../logic/room-layout'
import type { FloorGeometry } from '../scene-model'
import type { OfficeTheme } from '../themes/types'

export function FloorView({
  floor,
  theme,
  wallsMode,
  isReducedMotion
}: {
  floor: FloorGeometry
  theme: OfficeTheme
  wallsMode: WallsMode
  isReducedMotion: boolean
}) {
  const {
    Floor,
    Walls,
    Doorway,
    Desk,
    RoomDressing,
    Elevator,
    RoomSign,
    CompanyZone,
    ProjectOffice
  } = theme.kit
  return (
    <group>
      <Floor floor={floor} />
      {floor.zones
        .filter((zone) => zone.kind === 'company')
        .map((company) => (
          <group key={company.id}>
            <CompanyZone zone={company} />
            {company.children
              .filter((child) => child.kind === 'project')
              .map((project) => (
                <ProjectOffice key={project.id} zone={project} />
              ))}
          </group>
        ))}
      <Walls floor={floor} mode={wallsMode} isReducedMotion={isReducedMotion} />
      {floor.rooms.map((room) => (
        <group key={room.id}>
          <Doorway room={room} />
          <RoomSign room={room} />
          <RoomDressing room={room} />
          {room.seats.map((slot) => (
            <Desk key={slot.slotId} room={room} slot={slot} />
          ))}
        </group>
      ))}
      <Elevator floor={floor} />
    </group>
  )
}
