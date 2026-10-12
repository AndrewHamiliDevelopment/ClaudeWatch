import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import App from '../App'
import { DEFAULT_SETTINGS } from '../lib/types'
import { Header } from '../components/Header'
import { Settings } from '../components/Settings'
import { Dashboard } from '../components/Dashboard'

const { mockUseSettings, mockUseUpdater, mockUseInstances, mockUseUsage, mockUsePromoStatus } =
  vi.hoisted(() => ({
    mockUseSettings: vi.fn(),
    mockUseUpdater: vi.fn(),
    mockUseInstances: vi.fn(),
    mockUseUsage: vi.fn(),
    mockUsePromoStatus: vi.fn()
  }))

vi.mock('../hooks/useSettings', () => ({
  useSettings: mockUseSettings
}))

vi.mock('../hooks/useUpdater', () => ({
  useUpdater: mockUseUpdater
}))

vi.mock('../hooks/useInstances', () => ({
  useInstances: mockUseInstances
}))

vi.mock('../hooks/useUsage', () => ({
  useUsage: mockUseUsage
}))

vi.mock('../hooks/usePromoStatus', () => ({
  usePromoStatus: mockUsePromoStatus
}))

describe('scroll layout contract', () => {
  beforeEach(() => {
    mockUseSettings.mockReturnValue({
      settings: DEFAULT_SETTINGS,
      updateSettings: vi.fn(),
      loading: false
    })

    mockUseUpdater.mockReturnValue({
      status: 'idle',
      updateInfo: null,
      progress: null,
      error: null,
      checkForUpdates: vi.fn(),
      downloadUpdate: vi.fn(),
      installUpdate: vi.fn()
    })

    mockUseInstances.mockReturnValue([])

    mockUseUsage.mockReturnValue({
      usage: null,
      loading: false,
      refresh: vi.fn()
    })

    mockUsePromoStatus.mockReturnValue({
      promo: null
    })

    Reflect.deleteProperty(window, 'api')
  })

  it('renders settings inside a dedicated no-drag scroll region', () => {
    render(<Settings />)

    const scrollRegion = screen.getByTestId('settings-scroll-region')

    expect(scrollRegion.className).toContain('min-h-0')
    expect(scrollRegion.className).toContain('overflow-y-auto')
    expect(scrollRegion.className).toContain('no-drag')
  })

  it('renders dashboard results inside a dedicated no-drag scroll region', () => {
    render(<Dashboard />)

    const scrollRegion = screen.getByTestId('dashboard-scroll-region')

    expect(scrollRegion.className).toContain('min-h-0')
    expect(scrollRegion.className).toContain('overflow-y-auto')
    expect(scrollRegion.className).toContain('no-drag')
    expect(within(scrollRegion).getByText('No agents running')).toBeInTheDocument()
    expect(screen.getByRole('searchbox', { name: 'Find an agent' })).toBeInTheDocument()
  })

  it('makes only the header draggable', () => {
    render(<Header currentView="dashboard" onViewChange={vi.fn()} />)

    expect(screen.getByRole('banner').className).toContain('drag-region')
  })

  it('keeps the app shell non-draggable while switching scrollable views', () => {
    render(<App />)

    expect(screen.getByRole('main').className).toContain('no-drag')
    expect(screen.getByTestId('dashboard-scroll-region')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))

    expect(screen.getByTestId('settings-scroll-region')).toBeInTheDocument()
  })
})
