import type { ZoomBand } from '../logic/camera-bands'
import type { FloorGeometry } from '../scene-model'
import type { OfficeTheme, TowerFloor } from '../themes/types'
import { BatchedScene } from './BatchedScene'

// Merged like the floor: the skyline is the largest fixed cost in the draw budget.
export function WorldView({
  floor,
  theme,
  floors,
  band
}: {
  floor: FloorGeometry
  theme: OfficeTheme
  floors: readonly TowerFloor[]
  band: ZoomBand
}) {
  const { District, Hangar, Tower } = theme.world
  const hasTower = band === 'building'
  const revision = JSON.stringify([theme.id, hasTower, floor.width, floor.depth, floors])
  return (
    <BatchedScene revision={revision}>
      <District floor={floor} />
      <Hangar floor={floor} />
      {hasTower && (
        <group position={[floor.width / 2 + 7, 0, -floor.depth / 2 - 8]}>
          <Tower floors={floors} />
        </group>
      )}
    </BatchedScene>
  )
}
