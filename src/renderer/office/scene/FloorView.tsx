import { deskSlots, type WallsMode } from '../logic/room-layout'
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
  const { Floor, Walls, Doorway, Desk, RoomDressing, Elevator, RoomSign } = theme.kit
  return (
    <group>
      <Floor floor={floor} />
      <Walls floor={floor} mode={wallsMode} isReducedMotion={isReducedMotion} />
      {floor.rooms.map((room) => (
        <group key={room.id}>
          <Doorway room={room} />
          <RoomSign room={room} />
          <RoomDressing room={room} />
          {deskSlots(room).map((slot) => (
            <Desk key={slot.slotId} room={room} slot={slot} />
          ))}
        </group>
      ))}
      <Elevator floor={floor} />
    </group>
  )
}
