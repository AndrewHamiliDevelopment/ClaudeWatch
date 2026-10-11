import { Batch } from './primitives'
import type { ThemePalette } from './types'

export function ParkedFrames({ palette }: { palette: ThemePalette }) {
  const bodies = [-1.7, 1.7].map((x) => ({ x, y: 0.85, z: 1.5, rotationY: 0 }))
  return (
    <group>
      <Batch color={palette.lacquer} points={bodies}>
        <boxGeometry args={[0.42, 0.55, 0.28]} />
      </Batch>
      <Batch color={palette.brass} points={bodies.map((body) => ({ ...body, y: 1.25 }))}>
        <sphereGeometry args={[0.2, 10, 6]} />
      </Batch>
      <Batch
        color={palette.glow}
        glow
        points={bodies.map((body) => ({ ...body, y: 1.25, z: 1.69 }))}
      >
        <boxGeometry args={[0.24, 0.045, 0.025]} />
      </Batch>
      <Batch
        color={palette.copper}
        points={bodies.flatMap((body) =>
          [-1, 1].map((side) => ({
            ...body,
            x: body.x + side * 0.3,
            y: 0.8
          }))
        )}
      >
        <boxGeometry args={[0.12, 0.4, 0.15]} />
      </Batch>
      <Batch
        color={palette.ink}
        points={bodies.flatMap((body) =>
          [-1, 1].map((side) => ({
            ...body,
            x: body.x + side * 0.12,
            y: 0.45
          }))
        )}
      >
        <boxGeometry args={[0.1, 0.25, 0.14]} />
      </Batch>
    </group>
  )
}
