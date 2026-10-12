import type { TowerProps } from '../types'
import { ThemeTower } from '../WorldArchitecture'
import { GROVE_PALETTE } from './palette'

export function GroveTower(props: TowerProps) {
  return <ThemeTower {...props} palette={GROVE_PALETTE} />
}
