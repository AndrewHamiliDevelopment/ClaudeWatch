import type { ThemePalette } from '../types'

// The whole theme draws from these: every extra colour is an extra material, so an extra draw.
export const GARRISON = {
  hull: '#1F2329',
  deck: '#2E333B',
  gunmetal: '#474E59',
  steel: '#8A94A1',
  white: '#E6E8EA',
  // Burnt, not amber: the status palette already means "error" by a bright amber dot.
  orange: '#DB6B1E',
  navy: '#24364F',
  // Periwinkle, not cyan: the status palette already means "done" by a cyan dot.
  ice: '#A9C8FF',
  skin: '#D9A887',
  umber: '#8A5A3C'
} as const

export const GARRISON_PALETTE: ThemePalette = {
  lacquer: GARRISON.orange,
  ink: GARRISON.hull,
  gold: GARRISON.orange,
  brass: GARRISON.steel,
  copper: GARRISON.navy,
  paper: GARRISON.steel,
  wood: GARRISON.gunmetal,
  floor: GARRISON.deck,
  stone: GARRISON.deck,
  blossom: GARRISON.orange,
  glow: GARRISON.ice,
  steam: GARRISON.white
}
