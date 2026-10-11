import { useLayoutEffect } from 'react'
import { Matte } from '../scene/InstancedParts'
import { sensorOpening } from './layout'
import { EDO } from './palettes'
import { Batch, Box } from './primitives'
import { RobotEffects } from './RobotEffects'
import type { RobotModelProps } from './types'

export function SamuraiFrame({ agent, skin, rig }: RobotModelProps) {
  useLayoutEffect(() => {
    // Held articulation also works when the renderer disables its animation loop.
    if (rig.sensor.current) rig.sensor.current.rotation.x = sensorOpening(agent.activity)
  }, [agent.activity, rig.sensor])
  return (
    <>
      <group ref={rig.base}>
        <Batch
          color={EDO.ink}
          points={[-0.13, 0.13].map((x) => ({ x, y: 0.09, z: 0, rotationY: Math.PI / 2 }))}
        >
          <torusGeometry args={[0.085, 0.035, 4, 10]} />
        </Batch>
      </group>
      <group ref={rig.body}>
        <Box at={[0, 0.53, 0]} size={[0.3, 0.28, 0.19]} color={skin.body} />
        <Box at={[0, 0.47, 0.105]} size={[0.24, 0.045, 0.03]} color={skin.trim} />
        <Box at={[0, 0.35, 0]} size={[0.2, 0.06, 0.17]} color={EDO.ink} />
        <group ref={rig.legs}>
          <Batch
            color={skin.body}
            points={[-0.1, 0.1].map((x) => ({ x, y: 0.23, z: 0, rotationY: 0 }))}
          >
            <boxGeometry args={[0.09, 0.22, 0.12]} />
          </Batch>
          <Batch
            color={skin.trim}
            points={[-0.1, 0.1].map((x) => ({ x, y: 0.1, z: 0.065, rotationY: 0 }))}
          >
            <boxGeometry args={[0.12, 0.065, 0.22]} />
          </Batch>
        </group>
        <Box at={[0, 0.55, -0.16]} size={[0.23, 0.32, 0.16]} color={skin.body} />
        <group ref={rig.gear} position={[0, 0.57, -0.255]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 0.025, 8]} />
            <Matte color={skin.trim} />
          </mesh>
          <Box size={[0.025, 0.14, 0.03]} color={EDO.ink} />
        </group>
        <Batch
          color={skin.trim}
          points={[-0.075, 0.075].map((x) => ({ x, y: 0.76, z: -0.18, rotationY: 0 }))}
        >
          <cylinderGeometry args={[0.027, 0.034, 0.14, 6]} />
        </Batch>
        {(
          [
            ['left', -0.23, rig.leftArm],
            ['right', 0.23, rig.rightArm]
          ] as const
        ).map(([side, x, ref]) => (
          <group key={side} ref={ref} position={[x, 0.63, 0]}>
            <Batch
              color={skin.body}
              points={[0, 1, 2].map((i) => ({
                x: 0,
                y: -i * 0.055,
                z: 0,
                rotationY: 0,
                scaleX: 1 - i * 0.1
              }))}
            >
              <boxGeometry args={[0.18, 0.04, 0.22]} />
            </Batch>
            <Box at={[0, -0.2, 0]} size={[0.08, 0.22, 0.1]} color={skin.trim} />
            <Box at={[0, -0.22, 0.065]} size={[0.065, 0.09, 0.09]} color={EDO.ink} />
            <mesh position={[0, -0.22, 0.12]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.025, 0.09, 4]} />
              <Matte color={skin.trim} />
            </mesh>
          </group>
        ))}
        <group ref={rig.head} position={[0, 0.81, 0]}>
          <mesh scale={[1, 0.8, 1]}>
            <sphereGeometry args={[0.145, 10, 6]} />
            <Matte color={skin.body} />
          </mesh>
          <Box at={[0, -0.04, 0.125]} size={[0.22, 0.1, 0.045]} color={EDO.ink} />
          <mesh ref={rig.eye} position={[0, -0.015, 0.152]}>
            <boxGeometry args={[0.19, 0.025, 0.015]} />
            <Matte color={skin.eye} glow />
          </mesh>
          <group ref={rig.sensor} position={[0, 0.03, 0.14]}>
            <Box at={[0, 0.025, 0]} size={[0.22, 0.045, 0.025]} color={skin.body} />
          </group>
          <mesh position={[0, 0.16, 0.09]} rotation={[0, 0, Math.PI]}>
            <torusGeometry args={[agent.isSubagent ? 0.07 : 0.13, 0.017, 4, 12, Math.PI]} />
            <Matte color={skin.trim} />
          </mesh>
          <Batch
            color={skin.body}
            points={[-0.13, 0.13].map((x) => ({ x, y: -0.07, z: -0.015, rotationY: 0 }))}
          >
            <boxGeometry args={[0.035, 0.12, 0.2]} />
          </Batch>
        </group>
        <RobotEffects rig={rig} />
      </group>
    </>
  )
}
