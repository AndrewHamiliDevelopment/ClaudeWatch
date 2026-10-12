import type { AgentActivity } from '../../../shared/office/types'
import type { TowerFloor } from './types'

// One storey of a district's tower.
export const TOWER_STOREY_M = 2.2

export function towerLayout(floors: readonly TowerFloor[]) {
  return floors.map((floor, index) => ({
    ...floor,
    y: index * TOWER_STOREY_M,
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
