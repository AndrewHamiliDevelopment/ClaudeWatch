import { EventEmitter } from 'events'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { BACKGROUND_POLL_MS, LIVE_POLL_MS } from '../shared/office/pace'
import { paceBridgeByWindows } from './bridge-pace'

class FakeWindow extends EventEmitter {
  visible = false
  minimized = false
  destroyed = false
  isVisible = (): boolean => this.visible
  isMinimized = (): boolean => this.minimized
  isDestroyed = (): boolean => this.destroyed
}

describe('paceBridgeByWindows', () => {
  const app = new EventEmitter()
  let windows: FakeWindow[]
  const setPollInterval = vi.fn()

  const open = (): FakeWindow => {
    const window = new FakeWindow()
    windows.push(window)
    app.emit('browser-window-created', {}, window)
    return window
  }
  const show = (window: FakeWindow): void => {
    window.visible = true
    window.emit('show')
  }

  beforeEach(() => {
    app.removeAllListeners()
    windows = []
    setPollInterval.mockReset()
    paceBridgeByWindows(app, () => windows, setPollInterval)
  })

  it('polls slowly from the start, while no window is on screen', () => {
    expect(setPollInterval.mock.calls).toEqual([[BACKGROUND_POLL_MS]])
  })

  it('polls live as soon as any window shows, hidden ones not counting', () => {
    const dashboard = open()
    expect(setPollInterval).toHaveBeenLastCalledWith(BACKGROUND_POLL_MS)
    show(dashboard)
    expect(setPollInterval).toHaveBeenLastCalledWith(LIVE_POLL_MS)
  })

  it('slows down again once the last visible window is hidden, minimised or closed', () => {
    const [dashboard, popover, office] = [open(), open(), open()]
    for (const window of [dashboard, popover, office]) show(window)

    dashboard.visible = false
    dashboard.emit('hide')
    popover.minimized = true
    popover.emit('minimize')
    expect(setPollInterval).toHaveBeenLastCalledWith(LIVE_POLL_MS)

    office.destroyed = true
    office.emit('closed')
    expect(setPollInterval).toHaveBeenLastCalledWith(BACKGROUND_POLL_MS)

    popover.minimized = false
    popover.emit('restore')
    expect(setPollInterval).toHaveBeenLastCalledWith(LIVE_POLL_MS)
  })
})
