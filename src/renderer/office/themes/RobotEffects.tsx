import { SHARED_BATCH } from '../scene/mesh-batches'
import type { RobotModelProps } from './types'
import { EDO } from './palettes'
import { Batch } from './primitives'

// Every puff on the floor shares one geometry and one material, so steam is a single draw
// however many agents work. The price: a puff keeps one opacity instead of fading on its own.
const STEAM_BATCH = { [SHARED_BATCH]: 'agent-steam' }
const STEAM_OPACITY = 0.4

export function RobotEffects({ rig }: Pick<RobotModelProps, 'rig'>) {
  return (
    <>
      {rig.puffs.map((ref, index) => (
        <mesh
          key={index}
          ref={ref}
          position={[0.07, 1.12, -0.05]}
          visible={false}
          userData={STEAM_BATCH}
        >
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial
            color={EDO.steam}
            transparent
            opacity={STEAM_OPACITY}
            depthWrite={false}
            roughness={1}
          />
        </mesh>
      ))}
      <group ref={rig.thought} position={[0, 1.2, 0]} visible={false}>
        <Batch
          points={[-0.09, 0, 0.09].map((x) => ({ x, y: 0, z: 0, rotationY: 0 }))}
          color={EDO.steam}
          glow
        >
          <sphereGeometry args={[0.03, 8, 6]} />
        </Batch>
      </group>
    </>
  )
}
