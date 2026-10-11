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

describe('Settings: weekly token target', () => {
  const updateSettings = vi.fn()
  const field = (): HTMLElement => screen.getByRole('spinbutton', { name: 'Weekly token target' })

  beforeEach(() => {
    updateSettings.mockReset()
    mockUseUpdater.mockReturnValue({
      status: 'idle',
      updateInfo: null,
      progress: null,
      error: null
    })
    mockUseSettings.mockReturnValue({ settings: DEFAULT_SETTINGS, updateSettings, loading: false })
    render(<Settings />)
  })

  it('lets a number be typed digit by digit without saving half of it', () => {
    fireEvent.change(field(), { target: { value: '2' } })
    fireEvent.change(field(), { target: { value: '25' } })

    expect(field()).toHaveValue(25)
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('saves once on leaving the field, inside the allowed range', () => {
    fireEvent.change(field(), { target: { value: '25' } })
    fireEvent.blur(field())

    expect(updateSettings).toHaveBeenCalledTimes(1)
    expect(updateSettings).toHaveBeenCalledWith({ weeklyTokenTarget: 100_000 })
  })

  it('saves on Enter', () => {
    fireEvent.change(field(), { target: { value: '7500000' } })
    fireEvent.keyDown(field(), { key: 'Enter' })

    expect(updateSettings).toHaveBeenCalledWith({ weeklyTokenTarget: 7_500_000 })
  })

  it('puts the saved value back when the field is left empty', () => {
    fireEvent.change(field(), { target: { value: '' } })
    fireEvent.blur(field())

    expect(updateSettings).not.toHaveBeenCalled()
    expect(field()).toHaveValue(DEFAULT_SETTINGS.weeklyTokenTarget)
  })
})
