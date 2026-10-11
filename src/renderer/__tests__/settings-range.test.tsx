import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RangeSetting } from '../components/settings/controls'

describe('RangeSetting', () => {
  const setup = () => {
    const onCommit = vi.fn()
    render(
      <RangeSetting
        label="Stale threshold in minutes"
        min={5}
        max={120}
        step={5}
        value={30}
        formatValue={(minutes) => `${minutes}m`}
        onCommit={onCommit}
      />
    )
    return { onCommit, slider: screen.getByRole('slider', { name: 'Stale threshold in minutes' }) }
  }

  it('follows a drag on screen and saves once, when the drag ends', () => {
    const { onCommit, slider } = setup()
    for (const value of ['35', '40', '45']) fireEvent.change(slider, { target: { value } })

    expect(screen.getByText('45m')).toBeInTheDocument()
    expect(slider).toHaveAttribute('aria-valuetext', '45m')
    expect(onCommit).not.toHaveBeenCalled()

    fireEvent.pointerUp(slider)
    expect(onCommit).toHaveBeenCalledTimes(1)
    expect(onCommit).toHaveBeenCalledWith(45)
  })

  it('saves a keyboard step when the key is released', () => {
    const { onCommit, slider } = setup()
    fireEvent.change(slider, { target: { value: '35' } })
    fireEvent.keyUp(slider, { key: 'ArrowRight' })
    expect(onCommit).toHaveBeenCalledWith(35)
  })

  it('saves nothing when the value ends where it started', () => {
    const { onCommit, slider } = setup()
    fireEvent.change(slider, { target: { value: '35' } })
    fireEvent.change(slider, { target: { value: '30' } })
    fireEvent.blur(slider)
    expect(onCommit).not.toHaveBeenCalled()
  })
})
