import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AppSettings } from '../renderer/lib/types'
import { DEFAULT_SETTINGS } from '../renderer/lib/types'

/**
 * Tests the minimize-to-tray handler logic extracted from createWindow().
 * The handler reads settings.minimizeToTray and either hides the window
 * (preventDefault + hide) or allows default dock minimization.
 */

type MinimizeHandler = (event: { preventDefault: () => void }) => void

function createMinimizeHandler(getSettings: () => AppSettings, hide: () => void): MinimizeHandler {
  return (event) => {
    const settings = getSettings()
    if (settings.minimizeToTray) {
      event.preventDefault()
      hide()
    }
  }
}

describe('minimize-to-tray handler', () => {
  let preventDefault: ReturnType<typeof vi.fn>
  let hide: ReturnType<typeof vi.fn>

  beforeEach(() => {
    preventDefault = vi.fn()
    hide = vi.fn()
  })

  it('should prevent default and hide window when minimizeToTray is true', () => {
    const getSettings = vi.fn().mockReturnValue({ ...DEFAULT_SETTINGS, minimizeToTray: true })
    const handler = createMinimizeHandler(getSettings, hide)

    handler({ preventDefault })

    expect(preventDefault).toHaveBeenCalledOnce()
    expect(hide).toHaveBeenCalledOnce()
  })

  it('should allow default minimize behavior when minimizeToTray is false', () => {
    const getSettings = vi.fn().mockReturnValue({ ...DEFAULT_SETTINGS, minimizeToTray: false })
    const handler = createMinimizeHandler(getSettings, hide)

    handler({ preventDefault })

    expect(preventDefault).not.toHaveBeenCalled()
    expect(hide).not.toHaveBeenCalled()
  })

  it('should read settings on every minimize event (not cached)', () => {
    let callCount = 0
    const getSettings = vi.fn().mockImplementation(() => {
      callCount++
      return { ...DEFAULT_SETTINGS, minimizeToTray: callCount <= 1 }
    })
    const handler = createMinimizeHandler(getSettings, hide)

    // First call: minimizeToTray is true → hides
    handler({ preventDefault })
    expect(hide).toHaveBeenCalledOnce()

    // Second call: minimizeToTray is now false → allows default
    handler({ preventDefault })
    expect(hide).toHaveBeenCalledOnce() // still only 1 call
    expect(getSettings).toHaveBeenCalledTimes(2)
  })
})
