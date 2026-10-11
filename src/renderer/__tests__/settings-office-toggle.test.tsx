import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Settings } from '../components/Settings'
import { DEFAULT_SETTINGS } from '../lib/types'

const { mockUseSettings, mockUseUpdater } = vi.hoisted(() => ({
  mockUseSettings: vi.fn(),
  mockUseUpdater: vi.fn()
}))

vi.mock('../hooks/useSettings', () => ({ useSettings: mockUseSettings }))
vi.mock('../hooks/useUpdater', () => ({ useUpdater: mockUseUpdater }))

describe('Settings: open the Office on start', () => {
  const updateSettings = vi.fn()

  beforeEach(() => {
    updateSettings.mockReset()
    mockUseUpdater.mockReturnValue({
      status: 'idle',
      updateInfo: null,
      progress: null,
      error: null,
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      installUpdate: vi.fn()
    })
  })

  it('is off by default and turns on with one click', () => {
    mockUseSettings.mockReturnValue({ settings: DEFAULT_SETTINGS, updateSettings, loading: false })
    render(<Settings />)

    const toggle = screen.getByRole('switch', { name: 'Open the Office on start' })
    expect(toggle).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(toggle)
    expect(updateSettings).toHaveBeenCalledWith({ openOfficeOnLaunch: true })
  })

  it('shows the saved choice', () => {
    mockUseSettings.mockReturnValue({
      settings: { ...DEFAULT_SETTINGS, openOfficeOnLaunch: true },
      updateSettings,
      loading: false
    })
    render(<Settings />)

    expect(screen.getByRole('switch', { name: 'Open the Office on start' })).toHaveAttribute(
      'aria-checked',
      'true'
    )
  })
})
