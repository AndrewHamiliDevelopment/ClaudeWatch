import type { ThemePalette } from '../types'

// The whole theme draws from these: every extra colour is an extra material, so an extra draw.
export const COURT = {
  ink: '#15131A',
  violet: '#5B2A86',
  gold: '#C9A227',
  ivory: '#EDEBE6',
  crimson: '#A8252F',
  // Lilac, not cyan: the status palette already means "done" by a cyan dot.
  lumen: '#C9A8FF',
  slate: '#3A3D4A',
  marble: '#CFCAD6',
  skin: '#D9A887',
  courtyard: '#3B3350',
  deck: '#211D28'
} as const

export const COURT_PALETTE: ThemePalette = {
  lacquer: COURT.violet,
  ink: COURT.ink,
  gold: COURT.gold,
  brass: COURT.gold,
  copper: COURT.slate,
  paper: COURT.marble,
  wood: COURT.deck,
  floor: COURT.deck,
  stone: COURT.courtyard,
  blossom: COURT.crimson,
  glow: COURT.lumen,
  steam: COURT.ivory
}
