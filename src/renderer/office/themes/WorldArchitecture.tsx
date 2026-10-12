import { signTexture } from '../scene/textures'
import { APRON_PAVING } from './town-apron'
import { box, Parts } from './parts'
import { Batch, Box, Lantern } from './primitives'
import { towerLayout } from './layout'
import { WORLD_APRON } from './surroundings'
import type { FloorProps, ThemePalette, TowerProps } from './types'

// The paved band round the plate, in a colour that reads against the ground beyond it.
export function ApronPaving({ floor, color }: FloorProps & { color: string }) {
  const { west, east, north, south } = WORLD_APRON
  const { y, thickness } = APRON_PAVING
  const across = floor.width + west + east
  const centreX = (east - west) / 2
  return (
    <Parts
      parts={[
        box([centreX, y, -floor.depth / 2 - north / 2], [across, thickness, north], color),
        box([centreX, y, floor.depth / 2 + south / 2], [across, thickness, south], color),
        box([-floor.width / 2 - west / 2, y, 0], [west, thickness, floor.depth], color),
        box([floor.width / 2 + east / 2, y, 0], [east, thickness, floor.depth], color)
      ]}
    />
  )
}

function Roof({ width, palette }: { width: number; palette: ThemePalette }) {
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

export function ThemeTower({
  floors,
  palette,
  onFocusFloor
}: TowerProps & { palette: ThemePalette }) {
  return (
    <group>
      {towerLayout(floors).map((floor) => (
        <group
          key={floor.floorId}
          position={[0, floor.y, 0]}
          onClick={(event) => {
            event.stopPropagation()
            onFocusFloor?.(floor.floorId)
          }}
          onPointerOver={() => {
            if (onFocusFloor) document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            document.body.style.cursor = ''
          }}
        >
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
            <meshBasicMaterial map={signTexture(floor.label)} />
          </mesh>
          <mesh position={[0, 0.55, floor.width / 2 + 0.035]}>
            <planeGeometry args={[2.7, 0.32]} />
            <meshBasicMaterial
              map={signTexture(`${floor.agentCount ?? 0} agents · ${floor.attentionCount} waiting`)}
            />
          </mesh>
        </group>
      ))}
    </group>
  )
}
