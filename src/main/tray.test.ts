import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MenuItemConstructorOptions } from 'electron'
import type { ClaudeInstance } from '../renderer/lib/types'

const { trayListeners, buildFromTemplate } = vi.hoisted(() => ({
  trayListeners: new Map<string, () => void>(),
  buildFromTemplate: vi.fn((template: unknown) => template)
}))
vi.mock('electron', () => ({
  Tray: vi.fn().mockImplementation(() => ({
    setTitle: vi.fn(),
    setToolTip: vi.fn(),
    popUpContextMenu: vi.fn(),
    destroy: vi.fn(),
    on: (event: string, listener: () => void) => trayListeners.set(event, listener)
  })),
  Menu: { buildFromTemplate },
  nativeImage: { createEmpty: vi.fn() },
  screen: {}
}))
vi.mock('@electron-toolkit/utils', () => ({ is: { dev: false } }))
vi.mock('./window-factory', () => ({
  createAppWindow: () => ({ on: vi.fn(), loadFile: vi.fn(), isDestroyed: () => false })
}))

import { TrayManager } from './tray'

const instance = (overrides: Partial<ClaudeInstance>): ClaudeInstance => ({
  pid: 1,
  tty: '/dev/ttys001',
  status: 'active',
  cpuPercent: 1,
  memPercent: 1,
  elapsedTime: '00:05:00',
  elapsedSeconds: 300,
  projectPath: '/repo/app',
  projectName: 'app',
  flags: [],
  startedAt: new Date('2026-10-11T09:00:00Z'),
  ...overrides
})
const stats = { total: 2, active: 2, idle: 0, stale: 0, exited: 0, recentlyCompleted: 0 }

describe('TrayManager context menu', () => {
  const onFocusSession = vi.fn()
  let tray: TrayManager

  const openMenu = (): MenuItemConstructorOptions[] => {
    trayListeners.get('right-click')?.()
    return buildFromTemplate.mock.calls.at(-1)?.[0] as MenuItemConstructorOptions[]
  }
  const click = (item: MenuItemConstructorOptions | undefined): void =>
    (item?.click as (() => void) | undefined)?.()

  beforeEach(() => {
    vi.clearAllMocks()
    trayListeners.clear()
    tray = new TrayManager({
      onOpenDashboard: vi.fn(),
      onFocusSession,
      onQuit: vi.fn(),
      preloadPath: '/preload.js',
      store: {
        getPopoverPinned: () => false,
        getPopoverPosition: () => null,
        setPopoverPinned: vi.fn(),
        setPopoverPosition: vi.fn()
      }
    })
  })

  it('jumps to a session when its row is clicked', () => {
    tray.update(
      [instance({ pid: 4242, projectName: 'app' }), instance({ pid: 77, projectName: 'site' })],
      stats
    )
    const menu = openMenu()

    click(menu.find((item) => item.label?.includes('site')))
    expect(onFocusSession).toHaveBeenCalledExactlyOnceWith(77)
    click(menu.find((item) => item.label?.includes('app')))
    expect(onFocusSession).toHaveBeenLastCalledWith(4242)
  })

  it('keeps the headline and the overflow line as plain labels', () => {
    tray.update(
      Array.from({ length: 12 }, (_, index) => instance({ pid: index + 1 })),
      stats
    )
    const labels = openMenu().filter(
      (item) => item.label?.startsWith('ClaudeWatch') || item.label?.includes('more')
    )

    expect(labels).toHaveLength(2)
    for (const label of labels) {
      expect(label.enabled).toBe(false)
      expect(label.click).toBeUndefined()
    }
  })
})
