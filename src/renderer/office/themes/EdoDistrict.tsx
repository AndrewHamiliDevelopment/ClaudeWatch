import { Matte } from '../scene/InstancedParts'
import { districtLayout } from './layout'
import { EDO } from './palettes'
import { Batch, Box, Cylinder } from './primitives'
import { Sakura, Torii } from './EdoRoom'
import { Roof, ThemeTower } from './WorldArchitecture'
import type { FloorProps, TowerProps } from './types'

export function EdoTower(props: TowerProps) {
  return <ThemeTower {...props} palette={EDO} />
}

function StoneLantern() {
  return (
    <>
      <Cylinder at={[0, 0.5, 0]} radius={0.13} height={1} color={EDO.stone} />
      <Box at={[0, 1.05, 0]} size={[0.35, 0.3, 0.35]} color={EDO.glow} glow />
      <mesh position={[0, 1.32, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[0.4, 0.25, 4]} />
        <Matte color={EDO.stone} />
      </mesh>
    </>
  )
}

function Airship() {
  return (
    <group position={[0, 10, 0]}>
      <mesh scale={[2.4, 0.65, 0.65]}>
        <sphereGeometry args={[1, 12, 8]} />
        <Matte color={EDO.paper} />
      </mesh>
      <Box at={[0, -0.75, 0]} size={[1.6, 0.35, 0.5]} color={EDO.wood} />
      <Box at={[-1.9, 0.25, 0]} size={[0.6, 0.7, 0.1]} color={EDO.lacquer} />
    </group>
  )
}

export function EdoDistrict({ floor }: FloorProps) {
  const props = districtLayout(floor)
  return (
    <group>
      <Batch
        color={EDO.stone}
        points={[
          {
            x: 0,
            y: -0.35,
            z: floor.depth / 2 + 4,
            rotationY: 0,
            scaleX: floor.width + 20,
            scaleZ: 7
          },
          {
            x: 0,
            y: -0.35,
            z: -floor.depth / 2 - 4,
            rotationY: 0,
            scaleX: floor.width + 20,
            scaleZ: 7
          },
          { x: -floor.width / 2 - 5, y: -0.35, z: 0, rotationY: 0, scaleX: 9, scaleZ: floor.depth },
          { x: floor.width / 2 + 5, y: -0.35, z: 0, rotationY: 0, scaleX: 9, scaleZ: floor.depth }
        ]}
      >
        <boxGeometry args={[1, 0.2, 1]} />
      </Batch>
      {props.map((prop, index) => (
        <group key={index} position={[prop.x, 0, prop.z]}>
          {prop.kind === 'sakura' && <Sakura />}
          {prop.kind === 'lantern' && <StoneLantern />}
          {prop.kind === 'torii' && <Torii scale={3} />}
          {prop.kind === 'eaves' && <Roof width={Math.min(floor.width, 8)} palette={EDO} />}
          {prop.kind === 'pagoda' && (
            <EdoTower
              floors={Array.from({ length: index === 5 ? 3 : 4 }, (_, i) => ({
                floorId: `distant-${index}-${i}`,
                label: 'Foundry',
                attentionCount: 0
              }))}
            />
          )}
          {prop.kind === 'airship' && <Airship />}
          {prop.kind === 'vent' && (
            <>
              <Cylinder at={[0, 0.3, 0]} radius={0.15} height={0.6} color={EDO.copper} />
              <mesh position={[0, 0.75, 0]} scale={[0.3, 0.7, 0.3]}>
                <icosahedronGeometry args={[0.5, 0]} />
                <meshStandardMaterial
                  color={EDO.steam}
                  transparent
                  opacity={0.25}
                  depthWrite={false}
                  roughness={1}
                />
              </mesh>
            </>
          )}
        </group>
      ))}
      <Box at={[-floor.width / 2 - 2, 0.15, -1.5]} size={[0.12, 0.12, 3]} color={EDO.copper} />
    </group>
  )
}
