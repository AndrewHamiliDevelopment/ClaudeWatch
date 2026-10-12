import { fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createFrameMetrics } from '../frame-metrics'
import { chooseQuality, pinQuality, readQuality } from '../quality-store'
import { MetricsOverlay } from './MetricsOverlay'

beforeEach(() => {
  vi.spyOn(navigator, 'hardwareConcurrency', 'get').mockReturnValue(8)
  pinQuality('auto')
  chooseQuality('full')
})

const detailRow = (): string | null =>
  within(screen.getByLabelText('Render metrics')).getByText('detail').nextElementSibling
    ?.textContent ?? null

it('shows the level in use and that the Office chose it', () => {
  chooseQuality('balanced')
  render(<MetricsOverlay metrics={createFrameMetrics()} />)
  expect(detailRow()).toBe('balanced, chosen')
  expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true')
})

it('pins the level the owner picks and remembers it', () => {
  render(<MetricsOverlay metrics={createFrameMetrics()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Light' }))
  expect(readQuality().pin).toBe('light')
  expect(detailRow()).toBe('light, pinned')
  expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'false')
  expect(window.localStorage.getItem('claudewatch.office.quality')).toBe('light')
})

it('goes back to the level the Office chose when the owner picks Auto', () => {
  pinQuality('light')
  render(<MetricsOverlay metrics={createFrameMetrics()} />)
  fireEvent.click(screen.getByRole('button', { name: 'Auto' }))
  expect(detailRow()).toBe('full, chosen')
})

it('names the group of level buttons', () => {
  render(<MetricsOverlay metrics={createFrameMetrics()} />)
  const group = screen.getByRole('group', { name: 'Detail level' })
  expect(within(group).getAllByRole('button')).toHaveLength(4)
})
