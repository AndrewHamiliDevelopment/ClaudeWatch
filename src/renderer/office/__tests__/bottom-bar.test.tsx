import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomBar } from '../hud/BottomBar'

function setup(overrides: Partial<Parameters<typeof BottomBar>[0]> = {}) {
  const onRotate = vi.fn()
  const onZoom = vi.fn()
  const onFit = vi.fn()
  render(
    <BottomBar
      themeScope={null}
      themeLabel="Neo Edo Steam"
      onCycleTheme={vi.fn()}
      wallsMode="cutaway"
      isListView={false}
      is3DAvailable
      isMetricsVisible={false}
      onWallsMode={vi.fn()}
      onToggleList={vi.fn()}
      onToggleMetrics={vi.fn()}
      onRotate={onRotate}
      onZoom={onZoom}
      onFit={onFit}
      {...overrides}
    />
  )
  return { onRotate, onZoom, onFit }
}

describe('BottomBar camera controls', () => {
  it('offers Rotate left and Rotate right buttons with their shortcuts', () => {
    const { onRotate } = setup()
    const left = screen.getByRole('button', { name: 'Rotate left' })
    const right = screen.getByRole('button', { name: 'Rotate right' })
    expect(left).toHaveAttribute('aria-keyshortcuts', 'Q')
    expect(right).toHaveAttribute('aria-keyshortcuts', 'E')
    fireEvent.click(left)
    expect(onRotate).toHaveBeenLastCalledWith(-1)
    fireEvent.click(right)
    expect(onRotate).toHaveBeenLastCalledWith(1)
  })

  it('offers Zoom out, Zoom in and Fit with the keys that do the same', () => {
    const { onZoom, onFit } = setup()
    const zoomOut = screen.getByRole('button', { name: 'Zoom out' })
    const zoomIn = screen.getByRole('button', { name: 'Zoom in' })
    const fit = screen.getByRole('button', { name: 'Fit' })
    expect(zoomOut).toHaveAttribute('aria-keyshortcuts', '-')
    expect(zoomIn).toHaveAttribute('aria-keyshortcuts', '=')
    expect(fit).toHaveAttribute('aria-keyshortcuts', '0')
    expect(fit).toHaveTextContent('0')
    fireEvent.click(zoomOut)
    expect(onZoom).toHaveBeenLastCalledWith('out')
    fireEvent.click(zoomIn)
    expect(onZoom).toHaveBeenLastCalledWith('in')
    fireEvent.click(fit)
    expect(onFit).toHaveBeenCalledOnce()
  })

  it('disables the camera controls while the list view replaces the scene', () => {
    setup({ isListView: true })
    for (const name of ['Rotate left', 'Zoom in', 'Fit'])
      expect(screen.getByRole('button', { name })).toBeDisabled()
  })

  it('names the zone whose theme T cycles', () => {
    setup({ themeScope: 'ZKidz' })
    expect(screen.getByRole('button', { name: /ZKidz theme: Neo Edo Steam/ })).toBeInTheDocument()
  })
})
