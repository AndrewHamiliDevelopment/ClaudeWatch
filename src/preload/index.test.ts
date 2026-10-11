// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

const exposed = vi.hoisted(() => ({ api: null as unknown }))
const ipcRenderer = vi.hoisted(() => ({
  on: vi.fn(),
  removeListener: vi.fn(),
  invoke: vi.fn()
}))

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (key: string, api: unknown) => {
      if (key === 'api') exposed.api = api
    }
  },
  ipcRenderer
}))

import type { ElectronAPI } from './index'

describe('dashboard preload', () => {
  let api: ElectronAPI

  beforeEach(async () => {
    vi.clearAllMocks()
    await import('./index')
    api = exposed.api as ElectronAPI
  })

  it('asks main to focus a session by pid and returns where it landed', async () => {
    const landedOnApp = { success: false, reason: 'terminal-not-found', target: 'app' }
    ipcRenderer.invoke.mockResolvedValue(landedOnApp)

    expect(await api.focusSession(4242)).toEqual(landedOnApp)
    expect(ipcRenderer.invoke).toHaveBeenCalledExactlyOnceWith('session:focus', 4242)
  })

  it('asks main for the Office snapshot, which is null until the bridge reports', async () => {
    ipcRenderer.invoke.mockResolvedValue(null)

    expect(await api.getOfficeSnapshot()).toBeNull()
    expect(ipcRenderer.invoke).toHaveBeenCalledExactlyOnceWith('office:snapshot')
  })

  it('asks main to open the Office', async () => {
    ipcRenderer.invoke.mockResolvedValue({ success: true })

    expect(await api.openOffice()).toEqual({ success: true })
    expect(ipcRenderer.invoke).toHaveBeenCalledExactlyOnceWith('app:open-office')
  })
})
