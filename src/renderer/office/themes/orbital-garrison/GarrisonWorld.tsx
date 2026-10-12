import type { TowerProps } from '../types'
import { ThemeTower } from '../WorldArchitecture'
import { GARRISON_PALETTE } from './palette'

export function GarrisonTower(props: TowerProps) {
  return <ThemeTower {...props} palette={GARRISON_PALETTE} />
}
