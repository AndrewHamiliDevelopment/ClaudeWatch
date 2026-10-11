import { Matte } from '../scene/InstancedParts'
import { STEAM } from '../office-palette'
import { Batch, Box, Cylinder } from './primitives'
import { RobotEffects } from './RobotEffects'
import type { RobotModelProps } from './types'

export function BrassFrame({ skin, rig }: RobotModelProps) {
  return (
    <>
      <group ref={rig.base}>
        <Cylinder at={[0, 0.1, 0]} radius={0.16} height={0.1} color={STEAM.iron} />
      </group>
      <group ref={rig.body}>
        <mesh position={[0, 0.45, 0]}>
          <capsuleGeometry args={[0.2, 0.2, 4, 12]} />
          <Matte color={skin.body} />
        </mesh>
        <Batch
          color={skin.trim}
          points={[0.55, 0.45, 0.35].map((y) => ({ x: 0, y, z: 0.2, rotationY: 0 }))}
        >
          <sphereGeometry args={[0.022, 6, 4]} />
        </Batch>
        <group ref={rig.gear} position={[0, 0.48, -0.21]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.12, 0.12, 0.04, 8]} />
            <Matte color={skin.trim} />
          </mesh>
          <Box at={[0, 0.12, 0]} size={[0.05, 0.06, 0.04]} color={skin.trim} />
        </group>
        {([-1, 1] as const).map((side) => (
          <group
            key={side}
            ref={side < 0 ? rig.leftArm : rig.rightArm}
            position={[side * 0.25, 0.58, 0]}
          >
            <mesh position={[0, -0.14, 0]}>
              <capsuleGeometry args={[0.05, 0.18, 3, 8]} />
              <Matte color={skin.trim} />
            </mesh>
          </group>
        ))}
        <group ref={rig.head} position={[0, 0.8, 0]}>
          <mesh scale={[1, 0.85, 1]}>
            <sphereGeometry args={[0.17, 16, 12]} />
            <Matte color={skin.body} />
          </mesh>
          <mesh ref={rig.eye} position={[0, 0.01, 0.15]}>
            <boxGeometry args={[0.2, 0.055, 0.04]} />
            <Matte color={skin.eye} glow />
          </mesh>
          <Cylinder at={[0.07, 0.17, -0.05]} radius={0.03} height={0.1} color={skin.trim} />
        </group>
        <RobotEffects rig={rig} />
      </group>
    </>
  )
}
