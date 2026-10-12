import { act, render, screen, within } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { createFrameMetrics } from '../frame-metrics'
import { chooseQuality, pinQuality } from '../quality-store'
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
})

it('follows a level pinned in the settings, and the return to Auto', () => {
  render(<MetricsOverlay metrics={createFrameMetrics()} />)
  act(() => pinQuality('light'))
  expect(detailRow()).toBe('light, pinned')
  act(() => pinQuality('auto'))
  expect(detailRow()).toBe('full, chosen')
})

it('only reports: the level is changed in the settings panel', () => {
  render(<MetricsOverlay metrics={createFrameMetrics()} />)
  expect(screen.queryByRole('group', { name: 'Detail level' })).toBeNull()
  expect(screen.queryByRole('button')).toBeNull()
})
