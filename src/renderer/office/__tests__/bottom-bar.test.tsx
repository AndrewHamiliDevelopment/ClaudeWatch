import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { BottomBar } from '../hud/BottomBar'

function setup(overrides: Partial<Parameters<typeof BottomBar>[0]> = {}) {
  const onRotate = vi.fn()
  render(
    <BottomBar
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
      {...overrides}
    />
  )
  return { onRotate }
}

describe('BottomBar rotation', () => {
  it('offers visible Rotate left and Rotate right buttons with their shortcuts', () => {
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

  it('disables rotation while the list view replaces the scene', () => {
    setup({ isListView: true })
    expect(screen.getByRole('button', { name: 'Rotate left' })).toBeDisabled()
  })
})
