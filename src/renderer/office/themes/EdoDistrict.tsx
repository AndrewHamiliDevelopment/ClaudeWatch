import { useMemo } from 'react'
import { APRON_TOP_Y, apronLots, GATE } from './apron'
import { EDO_WORLD } from './EdoSurroundings'
import { LotParts } from './lot-parts'
import { EDO } from './palettes'
import { box, Parts, sphere } from './parts'
import { Torii } from './EdoRoom'
import { ApronPaving, ThemeTower } from './WorldArchitecture'
import type { FloorProps, TowerProps } from './types'

// Far enough north, and low enough, that the airship hides no desk at any map rotation.
const AIRSHIP = { west: 8, north: 15.5, y: 9 }
const AIRSHIP_PARTS = [
  sphere([0, 0, 0], [4.8, 1.3, 1.3], EDO.paper),
  box([0, -0.75, 0], [1.6, 0.35, 0.5], EDO.wood),
  box([-1.9, 0.25, 0], [0.6, 0.7, 0.1], EDO.lacquer)
]

export function EdoTower(props: TowerProps) {
  return <ThemeTower {...props} palette={EDO} />
}

// A raked-gravel apron of townhouses, gardens and pagodas, with the great gate on the south.
export function EdoDistrict({ floor }: FloorProps) {
  const lots = useMemo(() => apronLots(floor), [floor])
  return (
    <group>
      <ApronPaving floor={floor} color={EDO.floor} />
      <LotParts lots={lots} set={EDO_WORLD} baseOf={() => APRON_TOP_Y} />
      <group position={[0, APRON_TOP_Y, floor.depth / 2 + GATE.offsetZ]}>
        <Torii scale={2} />
      </group>
      <group
        position={[-floor.width / 2 - AIRSHIP.west, AIRSHIP.y, -floor.depth / 2 - AIRSHIP.north]}
      >
        <Parts parts={AIRSHIP_PARTS} />
      </group>
    </group>
  )
}
