import type { ZoomBand } from '../logic/camera-bands'
import type { FloorGeometry } from '../scene-model'
import type { OfficeTheme, TowerFloor } from '../themes/types'

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
  return (
    <group>
      <District floor={floor} />
      <Hangar floor={floor} />
      {band === 'building' && (
        <group position={[floor.width / 2 + 7, 0, -floor.depth / 2 - 8]}>
          <Tower floors={floors} />
        </group>
      )}
    </group>
  )
}
