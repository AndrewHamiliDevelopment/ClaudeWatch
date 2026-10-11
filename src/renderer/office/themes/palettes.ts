import { STEAM } from '../office-palette'
import type { ThemePalette } from './types'

export const EDO: ThemePalette = {
  lacquer: '#C8372D',
  ink: '#1C1A1E',
  gold: '#C9A227',
  brass: '#B08D57',
  copper: '#4F8A7B',
  paper: '#EFE6D2',
  wood: '#4A3426',
  floor: '#B9A86A',
  stone: '#8C8A85',
  blossom: '#F2B5C4',
  glow: '#FFC46B',
  steam: '#F4F1EA'
}

export const BRASS: ThemePalette = {
  lacquer: STEAM.copper,
  ink: STEAM.iron,
  gold: STEAM.brass,
  brass: STEAM.brass,
  copper: STEAM.copper,
  paper: STEAM.cream,
  wood: STEAM.darkWood,
  floor: STEAM.floorWood,
  stone: STEAM.ironLight,
  blossom: STEAM.copper,
  glow: STEAM.lampGlow,
  steam: STEAM.steam
}
