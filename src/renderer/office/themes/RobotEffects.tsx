import type { RobotModelProps } from './types'
import { EDO } from './palettes'
import { Batch } from './primitives'

export function RobotEffects({ rig }: Pick<RobotModelProps, 'rig'>) {
  return (
    <>
      {rig.puffs.map((ref, index) => (
        <mesh key={index} ref={ref} position={[0.07, 1.12, -0.05]} visible={false}>
          <sphereGeometry args={[1, 8, 6]} />
          <meshStandardMaterial
            ref={rig.puffMaterials[index]}
            color={EDO.steam}
            transparent
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
