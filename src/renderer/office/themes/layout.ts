import type { AgentActivity } from '../../../shared/office/types'
import type { FloorGeometry } from '../scene-model'
import type { TowerFloor } from './types'

export interface DistrictProp {
  kind: 'sakura' | 'lantern' | 'torii' | 'pagoda' | 'vent' | 'eaves' | 'airship'
  x: number
  z: number
  radius: number
}

export function districtLayout(floor: Pick<FloorGeometry, 'width' | 'depth'>): DistrictProp[] {
  const x = floor.width / 2
  const z = floor.depth / 2
  const roofRadius = Math.min(floor.width, 8) / 2 + 1
  return [
    { kind: 'sakura', x: -x - 4, z: -z - 4, radius: 1.5 },
    { kind: 'sakura', x: x + 4, z: z + 4, radius: 1.5 },
    { kind: 'lantern', x: -x - 2, z: z + 2, radius: 0.4 },
    { kind: 'lantern', x: x + 2, z: -z - 2, radius: 0.4 },
    { kind: 'torii', x: 0, z: z + 5, radius: 2.8 },
    { kind: 'pagoda', x: -x - 7, z: -z - 9, radius: 4 },
    { kind: 'pagoda', x: x + 6, z: -z - 12, radius: 4 },
    { kind: 'vent', x: -x - 2, z: 0, radius: 0.5 },
    { kind: 'vent', x: -x - 2, z: -3, radius: 0.5 },
    { kind: 'eaves', x: 0, z: -z - roofRadius - 1, radius: roofRadius },
    { kind: 'airship', x: -x - 9, z: -z - 16, radius: 3 }
  ]
}

export function towerLayout(floors: readonly TowerFloor[]) {
  return floors.map((floor, index) => ({
    ...floor,
    y: index * 2.2,
    width: Math.max(2.5, 5 - index * 0.2)
  }))
}

export function sensorOpening(activity: AgentActivity): number {
  return activity === 'thinking' ||
    activity === 'reading' ||
    activity === 'searching' ||
    activity === 'delegating'
    ? -0.8
    : 0
}
