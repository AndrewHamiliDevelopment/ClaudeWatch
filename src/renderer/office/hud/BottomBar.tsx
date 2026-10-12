import {
  ChevronUp,
  Maximize,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  type LucideIcon
} from 'lucide-react'
import { useId, useRef, useState, type ReactNode } from 'react'
import { Plate } from '../../components/deck/Plate'
import type { ZoomDirection } from '../logic/camera-bands'
import type { WallsMode } from '../logic/room-layout'
import { BAR_BUTTON_CLASS, KBD_CLASS } from './hud-styles'

interface BottomBarProps {
  floorThemeLabel: string
  // The themes list, shown above the bar while its button is open.
  renderThemes: (id: string, close: () => void) => ReactNode
  wallsMode: WallsMode
  isListView: boolean
  is3DAvailable: boolean
  isMetricsVisible: boolean
  onWallsMode: (mode: WallsMode) => void
  onToggleList: () => void
  onToggleMetrics: () => void
  onRotate: (direction: -1 | 1) => void
  onZoom: (direction: ZoomDirection) => void
  onFit: () => void
}

const WALL_OPTIONS: readonly { mode: WallsMode; label: string; key: string }[] = [
  { mode: 'up', label: 'Walls up', key: 'Home' },
  { mode: 'cutaway', label: 'Cutaway', key: 'W' },
  { mode: 'down', label: 'Walls down', key: 'End' }
]

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
      className={BAR_BUTTON_CLASS}
    >
      {props.label}
      {props.shortcut && <kbd className={KBD_CLASS}>{props.shortcut}</kbd>}
    </button>
  )
}

// A camera move the keyboard also makes: the icon is the label, the keycap shows the key.
function CameraButton(props: {
  label: string
  shortcut: string
  Icon: LucideIcon
  isDisabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={props.label}
      title={props.label}
      aria-keyshortcuts={props.shortcut}
      disabled={props.isDisabled}
      onClick={props.onClick}
      className={BAR_BUTTON_CLASS}
    >
      <props.Icon aria-hidden="true" className="size-3.5" />
      <kbd className={KBD_CLASS}>{props.shortcut}</kbd>
    </button>
  )
}

function Divider() {
  return <span aria-hidden="true" className="mx-1 h-5 w-px bg-border" />
}

export function BottomBar(props: BottomBarProps) {
  const isShowing3D = props.is3DAvailable && !props.isListView
  const [isThemesOpen, setIsThemesOpen] = useState(false)
  const themesButtonRef = useRef<HTMLButtonElement>(null)
  const themesId = useId()
  const closeThemes = (): void => {
    setIsThemesOpen(false)
    themesButtonRef.current?.focus()
  }
  return (
    <div className="relative">
      {isThemesOpen && props.renderThemes(themesId, closeThemes)}
      <Plate faceClassName="flex flex-wrap items-center gap-1 p-1.5">
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
        <Divider />
        {/* The same moves as the keys; right-drag turns the map freely and the wheel zooms. */}
        <div role="group" aria-label="Camera" className="flex gap-1">
          <CameraButton
            label="Rotate left"
            shortcut="Q"
            Icon={RotateCcw}
            isDisabled={!isShowing3D}
            onClick={() => props.onRotate(-1)}
          />
          <CameraButton
            label="Rotate right"
            shortcut="E"
            Icon={RotateCw}
            isDisabled={!isShowing3D}
            onClick={() => props.onRotate(1)}
          />
          <CameraButton
            label="Zoom out"
            shortcut="-"
            Icon={ZoomOut}
            isDisabled={!isShowing3D}
            onClick={() => props.onZoom('out')}
          />
          <CameraButton
            label="Zoom in"
            shortcut="="
            Icon={ZoomIn}
            isDisabled={!isShowing3D}
            onClick={() => props.onZoom('in')}
          />
          <CameraButton
            label="Fit"
            shortcut="0"
            Icon={Maximize}
            isDisabled={!isShowing3D}
            onClick={props.onFit}
          />
        </div>
        <Divider />
        <ToggleButton
          label="List view"
          shortcut="L"
          isPressed={props.isListView || !props.is3DAvailable}
          isDisabled={!props.is3DAvailable}
          onClick={props.onToggleList}
        />
        {/* Opens the list and changes nothing itself: a theme is only set where its scope is named. */}
        <button
          type="button"
          ref={themesButtonRef}
          aria-expanded={isThemesOpen}
          aria-controls={isThemesOpen ? themesId : undefined}
          onClick={() => setIsThemesOpen((isOpen) => !isOpen)}
          className={BAR_BUTTON_CLASS}
        >
          Floor theme: {props.floorThemeLabel}
          <ChevronUp aria-hidden="true" className="size-3.5" />
        </button>
        <ToggleButton
          label="Metrics"
          isPressed={props.isMetricsVisible}
          isDisabled={!isShowing3D}
          onClick={props.onToggleMetrics}
        />
      </Plate>
    </div>
  )
}
