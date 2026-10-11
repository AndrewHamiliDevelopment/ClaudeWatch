import { signTexture } from '../scene/textures'
import { Batch, Box, Lantern } from './primitives'
import { towerLayout } from './layout'
import type { ThemePalette, TowerProps } from './types'

export function Roof({ width, palette }: { width: number; palette: ThemePalette }) {
  const strips = [-1, 1].flatMap((side) =>
    [0, 1, 2].map((step) => ({
      x: 0,
      y: step === 2 ? 0.12 : 0.25 - step * 0.12,
      z: side * (width / 6 + (step * width) / 6),
      rotationY: 0,
      scaleX: width + 0.3 + step * 0.2,
      scaleZ: width / 6 + 0.05
    }))
  )
  return (
    <Batch points={strips} color={palette.ink}>
      <boxGeometry args={[1, 0.12, 1]} />
    </Batch>
  )
}

export function ThemeTower({ floors, palette }: TowerProps & { palette: ThemePalette }) {
  return (
    <group>
      {towerLayout(floors).map((floor) => (
        <group key={floor.floorId} position={[0, floor.y, 0]}>
          <Box at={[0, 0.9, 0]} size={[floor.width, 1.8, floor.width]} color={palette.wood} />
          <Batch
            color={palette.paper}
            points={[-1, 0, 1].map((x) => ({
              x,
              y: 0.95,
              z: floor.width / 2 + 0.01,
              rotationY: 0
            }))}
          >
            <boxGeometry args={[0.5, 0.7, 0.04]} />
          </Batch>
          <group position={[0, 1.9, 0]}>
            <Roof width={floor.width + 1} palette={palette} />
          </group>
          <Lantern
            at={[floor.width / 2 + 0.25, 1.2, 0]}
            color={floor.attentionCount > 0 ? palette.glow : palette.ink}
            frame={palette.brass}
          />
          <mesh position={[0, 1.55, floor.width / 2 + 0.035]}>
            <planeGeometry args={[2.7, 0.32]} />
            <meshBasicMaterial map={signTexture(`${floor.label} · ${floor.attentionCount}`)} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
