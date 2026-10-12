import { useEffect, useMemo } from 'react'
import { BufferAttribute, BufferGeometry } from 'three'
import type { TownDress } from './town-dress'
import { groundBuffers, groundQuads } from './town-ground'
import type { TownPlan } from './town-plan'

// The town's ground as one mesh coloured per vertex: roads, walks, the plaza and a pad under
// every block cost one draw between them. Unlit, so a zone's colour is the colour it was given.
export function TownGround({ plan, dress }: { plan: TownPlan; dress: TownDress }) {
  const geometry = useMemo(() => {
    const { positions, colors } = groundBuffers(groundQuads(plan, dress))
    return new BufferGeometry()
      .setAttribute('position', new BufferAttribute(positions, 3))
      .setAttribute('color', new BufferAttribute(colors, 3))
  }, [plan, dress])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <meshBasicMaterial vertexColors />
    </mesh>
  )
}
