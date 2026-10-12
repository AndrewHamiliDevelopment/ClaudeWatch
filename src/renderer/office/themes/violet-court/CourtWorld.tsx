import type { TowerProps } from '../types'
import { ThemeTower } from '../WorldArchitecture'
import { COURT_PALETTE } from './palette'

export function CourtTower(props: TowerProps) {
  return <ThemeTower {...props} palette={COURT_PALETTE} />
}
