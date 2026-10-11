import { RotateCcw, RotateCw } from 'lucide-react'
import { cn } from '../../lib/utils'
import type { WallsMode } from '../logic/room-layout'
import { FOCUS_RING_CLASS, HUD_BUTTON_CLASS, KBD_CLASS, PANEL_CLASS } from './hud-styles'

interface BottomBarProps {
  themeLabel: string
  onCycleTheme: () => void
  wallsMode: WallsMode
  isListView: boolean
  is3DAvailable: boolean
  isMetricsVisible: boolean
  onWallsMode: (mode: WallsMode) => void
  onToggleList: () => void
  onToggleMetrics: () => void
  onRotate: (direction: -1 | 1) => void
}

const WALL_OPTIONS: readonly { mode: WallsMode; label: string; key: string }[] = [
  { mode: 'up', label: 'Walls up', key: 'Home' },
  { mode: 'cutaway', label: 'Cutaway', key: 'W' },
  { mode: 'down', label: 'Walls down', key: 'End' }
]

// Same 90° snap as the Q and E keys; right-drag turns the map freely.
const ROTATE_OPTIONS = [
  { direction: -1, label: 'Rotate left', key: 'Q', Icon: RotateCcw },
  { direction: 1, label: 'Rotate right', key: 'E', Icon: RotateCw }
] as const

function ToggleButton(props: {
  isPressed: boolean
  isDisabled?: boolean
  onClick: () => void
  label: string
  shortcut?: string
}) {
  return (
    <button
      type="button"
      aria-pressed={props.isPressed}
      disabled={props.isDisabled}
      onClick={props.onClick}
      className={cn(
        HUD_BUTTON_CLASS,
        FOCUS_RING_CLASS,
        'flex items-center gap-1.5',
        props.isPressed && 'bg-accent-subtle'
      )}
    >
      {props.label}
      {props.shortcut && <kbd className={KBD_CLASS}>{props.shortcut}</kbd>}
    </button>
  )
}

export function BottomBar(props: BottomBarProps) {
  const isShowing3D = props.is3DAvailable && !props.isListView
  return (
    <div className={cn(PANEL_CLASS, 'flex flex-wrap items-center gap-1 p-1.5')}>
      <div role="group" aria-label="Walls" className="flex gap-1">
        {WALL_OPTIONS.map((option) => (
          <ToggleButton
            key={option.mode}
            label={option.label}
            shortcut={option.key}
            isPressed={props.wallsMode === option.mode}
            isDisabled={!isShowing3D}
            onClick={() => props.onWallsMode(option.mode)}
          />
        ))}
      </div>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border-strong" />
      <div role="group" aria-label="Rotate the map" className="flex gap-1">
        {ROTATE_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            aria-label={option.label}
            aria-keyshortcuts={option.key}
            disabled={!isShowing3D}
            onClick={() => props.onRotate(option.direction)}
            className={cn(HUD_BUTTON_CLASS, FOCUS_RING_CLASS, 'flex items-center gap-1.5')}
          >
            <option.Icon aria-hidden="true" className="size-3.5" />
            {option.label}
            <kbd className={KBD_CLASS}>{option.key}</kbd>
          </button>
        ))}
      </div>
      <span aria-hidden="true" className="mx-1 h-5 w-px bg-border-strong" />
      <ToggleButton
        label="List view"
        shortcut="L"
        isPressed={props.isListView || !props.is3DAvailable}
        isDisabled={!props.is3DAvailable}
        onClick={props.onToggleList}
      />
      <button
        type="button"
        onClick={props.onCycleTheme}
        className={cn(HUD_BUTTON_CLASS, FOCUS_RING_CLASS, 'flex items-center gap-1.5')}
      >
        Theme: {props.themeLabel} <kbd className={KBD_CLASS}>T</kbd>
      </button>
      <ToggleButton
        label="Metrics"
        isPressed={props.isMetricsVisible}
        isDisabled={!isShowing3D}
        onClick={props.onToggleMetrics}
      />
    </div>
  )
}
