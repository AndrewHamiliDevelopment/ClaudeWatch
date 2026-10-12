import { HANGAR } from './apron'
import { ParkedFrames } from './ParkedFrames'
import { Batch, Box } from './primitives'
import { EDO } from './palettes'
import type { FloorProps, ThemePalette } from './types'

export function MaintenanceHangar({
  floor,
  palette = EDO
}: FloorProps & { palette?: ThemePalette }) {
  return (
    <group position={[floor.width / 2 + HANGAR.offsetX, 0, 0]}>
      <ParkedFrames palette={palette} />
      <Box at={[0, -0.12, 0]} size={[HANGAR.width, 0.2, HANGAR.depth]} color={palette.ink} />
      <Batch
        color={palette.lacquer}
        points={[-2.6, 2.6].flatMap((x) => [-3, 3].map((z) => ({ x, y: 1.8, z, rotationY: 0 })))}
      >
        <boxGeometry args={[0.18, 3.6, 0.18]} />
      </Batch>
      <Box at={[0, 3.6, -1]} size={[5.8, 0.3, 0.25]} color={palette.brass} />
      <Box at={[0.6, 2.9, -1]} size={[0.08, 1.1, 0.08]} color={palette.copper} />
      <Box at={[0.6, 2.35, -0.9]} size={[0.25, 0.08, 0.25]} color={palette.brass} />
      <Batch
        color={palette.copper}
        points={[-1.7, 0, 1.7].map((x) => ({ x, y: 0.15, z: 1.5, rotationY: 0 }))}
      >
        <boxGeometry args={[1.25, 0.3, 1.5]} />
      </Batch>
      <Batch
        color={palette.brass}
        points={[-1.7, 0, 1.7].flatMap((x) =>
          [-0.5, 0.5].map((dx) => ({ x: x + dx, y: 0.85, z: 2, rotationY: 0 }))
        )}
      >
        <boxGeometry args={[0.08, 1.4, 0.08]} />
      </Batch>
      <Batch
        color={palette.glow}
        glow
        points={[-1.7, 0, 1.7].map((x) => ({ x, y: 0.85, z: 2.02, rotationY: 0 }))}
      >
        <boxGeometry args={[0.4, 0.08, 0.06]} />
      </Batch>
      <Batch
        color={palette.gold}
        points={Array.from({ length: 12 }, (_, i) => ({
          x: -2.7 + i * 0.48,
          y: 0.012,
          z: -3,
          rotationY: Math.PI / 4
        }))}
      >
        <boxGeometry args={[0.16, 0.025, 0.6]} />
      </Batch>
    </group>
  )
}

export function EdoHangar(props: FloorProps) {
  return <MaintenanceHangar {...props} />
}
