import type { ZoomDirection } from './camera-bands'
import type { WallsMode } from './room-layout'

export type OfficeCommand =
  | { type: 'walls'; mode: WallsMode }
  | { type: 'next-attention' }
  | { type: 'toggle-list' }
  | { type: 'cycle-theme' }
  | { type: 'floor-step'; delta: -1 | 1 }
  | { type: 'floor-number'; number: number }
  | { type: 'rotate'; direction: -1 | 1 }
  | { type: 'zoom'; direction: ZoomDirection }
  | { type: 'fly-to-selected' }

export interface KeyInput {
  key: string
  hasModifier: boolean
  isTargetEditable: boolean
  // A focused button or link owns Enter, so it must not also fly the camera.
  isTargetInteractive: boolean
}

const FIXED_COMMANDS: Record<string, OfficeCommand> = {
  home: { type: 'walls', mode: 'up' },
  w: { type: 'walls', mode: 'cutaway' },
  end: { type: 'walls', mode: 'down' },
  n: { type: 'next-attention' },
  l: { type: 'toggle-list' },
  t: { type: 'cycle-theme' },
  '[': { type: 'floor-step', delta: -1 },
  ']': { type: 'floor-step', delta: 1 },
  q: { type: 'rotate', direction: -1 },
  e: { type: 'rotate', direction: 1 },
  '-': { type: 'zoom', direction: 'out' },
  '=': { type: 'zoom', direction: 'in' },
  '+': { type: 'zoom', direction: 'in' }
}

export function commandForKey(input: KeyInput): OfficeCommand | null {
  if (input.hasModifier || input.isTargetEditable) return null
  if (input.key === 'Enter') return input.isTargetInteractive ? null : { type: 'fly-to-selected' }
  if (/^[1-9]$/.test(input.key)) return { type: 'floor-number', number: Number(input.key) }
  return FIXED_COMMANDS[input.key.toLowerCase()] ?? null
}

export function keyInputFrom(event: KeyboardEvent): KeyInput {
  const target = event.target instanceof HTMLElement ? event.target : null
  return {
    key: event.key,
    hasModifier: event.metaKey || event.ctrlKey || event.altKey,
    isTargetEditable: Boolean(target?.closest('input, textarea, select, [contenteditable="true"]')),
    isTargetInteractive: Boolean(target?.closest('button, a[href], summary'))
  }
}
