import { EDO } from './palettes'
import { ThemeTower } from './WorldArchitecture'
import type { TowerProps } from './types'

export function EdoTower(props: TowerProps) {
  return <ThemeTower {...props} palette={EDO} />
}
