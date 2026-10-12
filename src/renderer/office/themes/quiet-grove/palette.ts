import type { ThemePalette } from '../types'

// The whole theme draws from these: every extra colour is an extra material, so an extra draw.
export const GROVE = {
  soil: '#2B2A26',
  bark: '#5A4332',
  timber: '#9C7650',
  // Darker than the furniture standing on it, and dark enough for the cards floating over it.
  deck: '#7A5C3C',
  pine: '#3A5236',
  moss: '#4E6E42',
  fern: '#88A86B',
  stone: '#9A9C94',
  paper: '#EFE8D6',
  pond: '#5FA8A0',
  clay: '#C27D5A',
  // Lantern light: paler than the status palette's question yellow.
  lumen: '#FFE9B0',
  // Needs-you only. No status dot, ground or other glow is this pink.
  beacon: '#FFA8D8'
} as const

export const GROVE_PALETTE: ThemePalette = {
  lacquer: GROVE.stone,
  ink: GROVE.soil,
  gold: GROVE.timber,
  brass: GROVE.bark,
  copper: GROVE.clay,
  paper: GROVE.pine,
  wood: GROVE.bark,
  floor: GROVE.bark,
  stone: GROVE.moss,
  blossom: GROVE.beacon,
  glow: GROVE.lumen,
  steam: GROVE.paper
}
