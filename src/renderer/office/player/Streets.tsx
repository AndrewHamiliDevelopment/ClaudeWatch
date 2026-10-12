import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import { streetRects, streetVertices } from '../logic/streets'
import type { FloorGeometry } from '../scene-model'
import type { Lot } from '../themes/surroundings'

// The town's roads as one mesh in one colour: one draw however many streets there are.
export function Streets({
  floor,
  solids,
  color
}: {
  floor: FloorGeometry
  solids: readonly Lot[]
  color: string
}) {
  const geometry = useMemo(() => {
    const vertices = streetVertices(streetRects(floor, solids))
    return new BufferGeometry().setAttribute('position', new BufferAttribute(vertices, 3))
  }, [floor, solids])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial color={color} />
    </mesh>
  )
}
