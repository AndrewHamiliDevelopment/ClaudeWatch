import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { Header } from '../components/Header'

describe('Header', () => {
  it('offers every page, Models included', () => {
    render(<Header currentView="dashboard" onViewChange={() => {}} />)
    const pages = screen.getAllByRole('button').map((button) => button.textContent)
    expect(pages).toEqual(['Dashboard', 'History', 'Models', 'Settings'])
  })

  it('highlights the current view', () => {
    render(<Header currentView="dashboard" onViewChange={() => {}} />)
    expect(screen.getByRole('button', { name: 'Dashboard' })).toHaveAttribute(
      'aria-current',
      'page'
    )
    expect(screen.getByRole('button', { name: 'History' })).not.toHaveAttribute('aria-current')
  })

  it('calls onViewChange when a page is chosen', () => {
    const onViewChange = vi.fn()
    render(<Header currentView="dashboard" onViewChange={onViewChange} />)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(onViewChange).toHaveBeenCalledWith('settings')
  })
})
