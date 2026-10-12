import { useCallback, useEffect, useState, type Dispatch } from 'react'
import type { OfficeAction } from './logic/office-reducer'
import { useOfficeSettings } from './logic/office-settings'
import { useOfficeHotkeys, type HotkeyHandlers } from './use-office-effects'

// What the owner's switches mean for the page around the scene: the keys, the Walk control and
// the settings panel. The scene reads the same switches for the layers it mounts.
export function useOfficeFeatures(
  dispatch: Dispatch<OfficeAction>,
  isListForced: boolean,
  isWalking: boolean,
  handlers: Omit<HotkeyHandlers, 'onToggleSettings'>
) {
  const { player: hasPlayer } = useOfficeSettings()
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const toggleSettings = useCallback(() => setIsSettingsOpen((isOpen) => !isOpen), [])
  const { onCycleTheme, onFocusTerminal } = handlers
  useOfficeHotkeys(
    dispatch,
    isListForced,
    { onCycleTheme, onFocusTerminal, onToggleSettings: toggleSettings },
    isWalking,
    hasPlayer
  )
  // Walking ends with the player, so switching it back on does not set off on its own.
  useEffect(() => {
    if (!hasPlayer && isWalking) dispatch({ type: 'walk-toggled' })
  }, [hasPlayer, isWalking, dispatch])
  return { hasPlayer, isSettingsOpen, toggleSettings }
}
