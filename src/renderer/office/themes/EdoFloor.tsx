import { EDO } from './palettes'
import { Batch, Box } from './primitives'
import type { FloorProps, RoomsProps } from './types'
import type { InstancePlacement } from '../scene/instancing'

export function EdoSlab({ floor }: FloorProps) {
  return (
    <>
      <Box at={[0, -0.16, 0]} size={[floor.width + 1, 0.3, floor.depth + 1]} color={EDO.wood} />
      <Box
        at={[0, -0.005, floor.corridor.z]}
        size={[floor.width, 0.02, floor.corridor.width]}
        color={EDO.ink}
      />
    </>
  )
}

export function EdoRoomFloors({ rooms }: RoomsProps) {
  const mats: InstancePlacement[] = []
  for (const room of rooms) {
    const columns = Math.max(1, Math.ceil(room.width / 1.8))
    const rows = Math.max(1, Math.ceil(room.depth / 0.9))
    for (let col = 0; col < columns; col++) {
      for (let row = 0; row < rows; row++) {
        mats.push({
          x: room.x - room.width / 2 + ((col + 0.5) * room.width) / columns,
          y: 0.012,
          z: room.z - room.depth / 2 + ((row + 0.5) * room.depth) / rows,
          rotationY: 0,
          scaleX: room.width / columns - 0.035,
          scaleZ: room.depth / rows - 0.035
        })
      }
    }
  }
  return (
    <Batch color={EDO.floor} points={mats}>
      <boxGeometry args={[1, 0.02, 1]} />
    </Batch>
  )
}
