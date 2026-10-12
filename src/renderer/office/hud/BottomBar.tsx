import {
  ChevronUp,
  Maximize,
  RotateCcw,
  RotateCw,
  ZoomIn,
  ZoomOut,
  type LucideIcon
} from 'lucide-react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Plate } from '../../components/deck/Plate'
import type { ZoomDirection } from '../logic/camera-bands'
import { SETTINGS_KEY, WALK_KEYS } from '../logic/hotkeys'
import type { WallsMode } from '../logic/room-layout'
import { BAR_BUTTON_CLASS, KBD_CLASS } from './hud-styles'
import { OfficeSettingsPanel } from './OfficeSettings'

interface BottomBarProps {
  floorThemeLabel: string
  // The themes list, shown above the bar while its button is open.
  renderThemes: (id: string, close: () => void) => ReactNode
  wallsMode: WallsMode
  isListView: boolean
  is3DAvailable: boolean
  isMetricsVisible: boolean
  // The owner is moving their own character through the office.
  isWalking: boolean
  onToggleWalk: () => void
  // False while the owner's character is switched off: no Walk button, no walking hint.
  hasPlayer: boolean
  // Held above the bar so the settings key opens the panel too.
  isSettingsOpen: boolean
  onToggleSettings: () => void
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
  const { isSettingsOpen, onToggleSettings } = props
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const settingsId = useId()
  // One panel stands above the bar at a time; the settings are the later arrival.
  const isShowingThemes = isThemesOpen && !isSettingsOpen
  const wasSettingsOpenRef = useRef(isSettingsOpen)
  useEffect(() => {
    const hasClosed = wasSettingsOpenRef.current && !isSettingsOpen
    wasSettingsOpenRef.current = isSettingsOpen
    // The panel took focus with it when it closed, unless another control was clicked.
    const isFocusLost = !document.activeElement || document.activeElement === document.body
    if (hasClosed && isFocusLost) settingsButtonRef.current?.focus()
  }, [isSettingsOpen])
  const toggleThemes = (): void => {
    if (isSettingsOpen) onToggleSettings()
    setIsThemesOpen(!isShowingThemes)
  }
  const toggleSettings = (): void => {
    setIsThemesOpen(false)
    onToggleSettings()
  }
  return (
    <div className="relative">
      {isShowingThemes && props.renderThemes(themesId, closeThemes)}
      {isSettingsOpen && <OfficeSettingsPanel id={settingsId} onClose={onToggleSettings} />}
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
        {props.hasPlayer && (
          <ToggleButton
            label="Walk"
            shortcut={WALK_KEYS.toggle}
            isPressed={props.isWalking && isShowing3D}
            isDisabled={!isShowing3D}
            onClick={props.onToggleWalk}
          />
        )}
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
          aria-expanded={isShowingThemes}
          aria-controls={isShowingThemes ? themesId : undefined}
          onClick={toggleThemes}
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
        {/* Never disabled: the switches are also how a struggling machine gets its 3D view back. */}
        <button
          type="button"
          ref={settingsButtonRef}
          aria-expanded={isSettingsOpen}
          aria-controls={isSettingsOpen ? settingsId : undefined}
          aria-keyshortcuts={SETTINGS_KEY}
          onClick={toggleSettings}
          className={BAR_BUTTON_CLASS}
        >
          Settings
          <kbd className={KBD_CLASS}>{SETTINGS_KEY}</kbd>
        </button>
        {props.hasPlayer && props.isWalking && isShowing3D && (
          <p className="basis-full px-1 pb-0.5 text-xs text-text-secondary">
            Arrow keys or W A S D to walk, click to go there, {WALK_KEYS.talk} to talk to the agent
            beside you.
          </p>
        )}
      </Plate>
    </div>
  )
}
