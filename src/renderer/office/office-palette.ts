import type { ProviderId } from '../../shared/office/types'
import type { CardStatus } from './logic/name-cards'

// three.js materials cannot read Tailwind classes, so the scene keeps its colours here.
// Values that exist as tokens mirror tailwind.config.ts (surface, accent, status.*).
export const PROVIDER_LABEL: Record<ProviderId, string> = {
  claude: 'Claude',
  codex: 'Codex'
}

export const STATE_COLOR = {
  permission: '#FF453A', // status.exited
  question: '#FFD60A', // status.idle
  done: '#64D2FF', // status.finished
  error: '#FF9F0A',
  limited: '#8E8E93',
  working: '#7C5CFC' // accent
} as const

export const CARD_STATUS_COLOR: Record<CardStatus, string> = {
  working: '#30D158', // status.active
  waiting: STATE_COLOR.question,
  permission: STATE_COLOR.permission,
  done: STATE_COLOR.done,
  error: STATE_COLOR.error,
  limited: STATE_COLOR.limited,
  idle: STATE_COLOR.limited
}

// Mecha-steampunk kit (owner art direction 2026-10-11): muted metals and woods, status colours only for state.
export const STEAM = {
  brass: '#B08D57',
  copper: '#B87333',
  iron: '#3A3A40',
  ironLight: '#4A4A52',
  darkWood: '#5C4033',
  floorWood: '#8A6644',
  cream: '#E8DCC4',
  steam: '#F4F1EA',
  crtBody: '#2B2B30',
  crtScreen: '#6EF59A',
  lampGlow: '#FFD58A',
  rivetLight: '#FFB347',
  signText: '#2A2118',
  slab: '#2A2622'
} as const

export const SCENE_BACKGROUND = '#0E0E10' // surface

export interface RobotPalette {
  body: string
  trim: string
  eye: string
}

export const ROBOT_PALETTE: Record<ProviderId, RobotPalette> = {
  claude: { body: STEAM.brass, trim: STEAM.copper, eye: '#FFB347' },
  codex: { body: '#4A4F57', trim: '#2FB3A6', eye: '#5FE3D3' }
}
