import { doorSide, inwardHeading } from '../logic/room-layout'
import { STEAM } from '../office-palette'
import { Matte } from '../scene/InstancedParts'
import type { RoomProps } from './types'

export function BrassRoomDressing({ room }: RoomProps) {
  const side = doorSide(room)
  const isDoorOnZ = side === 'north' || side === 'south'
  const heading = inwardHeading(room)
  const backReach = (isDoorOnZ ? room.depth : room.width) / 2 - 0.55
  const across = (isDoorOnZ ? room.width : room.depth) / 2 - 0.55
  const x = room.x + Math.sin(heading) * backReach + (isDoorOnZ ? across : 0)
  const z = room.z + Math.cos(heading) * backReach + (isDoorOnZ ? 0 : across)
  return (
    <group position={[x, 0, z]} rotation={[0, heading, 0]}>
      <mesh position={[0, 0.475, 0]}>
        <cylinderGeometry args={[0.26, 0.26, 0.95, 12]} />
        <Matte color={STEAM.copper} />
      </mesh>
      <mesh position={[0, 1.07, 0]}>
        <sphereGeometry args={[0.13, 12, 8]} />
        <Matte color={STEAM.cream} />
      </mesh>
    </group>
  )
}
