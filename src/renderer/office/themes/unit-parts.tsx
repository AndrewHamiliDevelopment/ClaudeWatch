import { Matte } from '../scene/InstancedParts'
import type { Vector } from './primitives'

// One geometry per shape, each one unit across: BatchedScene merges by geometry and material,
// so a cast of characters costs a draw per shape and colour, not one per part.
export const UNIT_SHAPES = {
  box: <boxGeometry args={[1, 1, 1]} />,
  sphere: <sphereGeometry args={[0.5, 10, 6]} />,
  cylinder: <cylinderGeometry args={[0.5, 0.5, 1, 8]} />,
  cone: <coneGeometry args={[0.5, 1, 6]} />
}
export type UnitShape = keyof typeof UNIT_SHAPES

// dry-new: primitives.Box bakes its size into the geometry, which gives every part its own draw.
export function UnitPart({
  shape,
  at = [0, 0, 0],
  size,
  rotation = [0, 0, 0],
  color,
  glow = false
}: {
  shape: UnitShape
  at?: Vector
  size: Vector
  rotation?: Vector
  color: string
  glow?: boolean
}) {
  return (
    <mesh position={at} rotation={rotation} scale={size}>
      {UNIT_SHAPES[shape]}
      <Matte color={color} glow={glow} />
    </mesh>
  )
}
