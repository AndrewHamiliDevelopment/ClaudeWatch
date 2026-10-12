import { beforeEach, describe, expect, it, vi } from 'vitest'
import { jumpToAgent, openOffice } from '../deck/deck-api'
import { mockApi } from './api-mock'

const target = { pid: 4321, projectPath: '/w/app', terminalType: 'ghostty' as const }

describe('jumpToAgent', () => {
  beforeEach(() => {
    Reflect.deleteProperty(window, 'api')
  })

  it('focuses the exact session by pid and opens no second terminal', async () => {
    const focusSession = vi.fn().mockResolvedValue({ success: true, target: 'pane' })
    const openTerminal = vi.fn().mockResolvedValue({ success: true })
    window.api = mockApi({ focusSession, openTerminal })

    await jumpToAgent(target)

    expect(focusSession).toHaveBeenCalledWith(4321)
    expect(openTerminal).not.toHaveBeenCalled()
  })

  it('opens the terminal at the project when the session could not be focused', async () => {
    const focusSession = vi.fn().mockResolvedValue({ success: false, reason: 'not-in-orca' })
    const openTerminal = vi.fn().mockResolvedValue({ success: true })
    window.api = mockApi({ focusSession, openTerminal })

    await jumpToAgent(target)

    expect(openTerminal).toHaveBeenCalledWith('/w/app', 'ghostty')
  })

  it('opens no terminal when Orca came forward but the pane could not be proven', async () => {
    const focusSession = vi
      .fn()
      .mockResolvedValue({ success: false, target: 'app', reason: 'terminal-not-found' })
    const openTerminal = vi.fn().mockResolvedValue({ success: true })
    window.api = mockApi({ focusSession, openTerminal })

    await jumpToAgent(target)

    expect(openTerminal).not.toHaveBeenCalled()
  })

  it('opens the terminal when the session has no process to focus', async () => {
    const focusSession = vi.fn()
    const openTerminal = vi.fn().mockResolvedValue({ success: true })
    window.api = mockApi({ focusSession, openTerminal })

    await jumpToAgent({ ...target, pid: null })

    expect(focusSession).not.toHaveBeenCalled()
    expect(openTerminal).toHaveBeenCalledWith('/w/app', 'ghostty')
  })

  it('opens the terminal when the focus request itself fails', async () => {
    const focusSession = vi.fn().mockRejectedValue(new Error('no handler registered'))
    const openTerminal = vi.fn().mockResolvedValue({ success: true })
    window.api = mockApi({ focusSession, openTerminal })

    await jumpToAgent(target)

    expect(openTerminal).toHaveBeenCalledWith('/w/app', 'ghostty')
  })

  it('does nothing outside the app shell', async () => {
    await expect(jumpToAgent(target)).resolves.toBeUndefined()
  })
})

describe('openOffice', () => {
  it('asks the main process to open the Office', () => {
    const open = vi.fn().mockResolvedValue({ success: true })
    window.api = mockApi({ openOffice: open })

    openOffice()

    expect(open).toHaveBeenCalledOnce()
  })
})
