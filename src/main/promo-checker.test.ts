import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  BrowserWindow: vi.fn()
}))

import { PromoChecker } from './promo-checker'

function makeMockWindow(destroyed = false) {
  return {
    isDestroyed: () => destroyed,
    webContents: { send: vi.fn() }
  }
}

describe('PromoChecker', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns promoActive=true during promo period', () => {
    // Wednesday March 18, 2026 10:00 ET = 14:00 UTC
    vi.setSystemTime(new Date('2026-03-18T14:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.promoActive).toBe(true)
    expect(status.promoPeriod).toBe('March 13–27, 2026')
  })

  it('returns promoActive=false after promo period', () => {
    // March 28, 2026 — after promo
    vi.setSystemTime(new Date('2026-03-28T14:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.promoActive).toBe(false)
    expect(status.is2x).toBe(false)
  })

  it('returns promoActive=false before promo period', () => {
    vi.setSystemTime(new Date('2026-03-12T14:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.promoActive).toBe(false)
    expect(status.is2x).toBe(false)
  })

  it('returns is2x=true during weekday 2x window (8 AM–2 PM ET)', () => {
    // Wednesday March 18, 2026 10:00 ET = 15:00 UTC
    vi.setSystemTime(new Date('2026-03-18T15:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.is2x).toBe(true)
    expect(status.isWeekend).toBe(false)
    expect(status.expiresInSeconds).toBeGreaterThan(0)
    expect(status.currentWindowEnd).toBeTruthy()
  })

  it('returns is2x=false during weekday outside 2x window', () => {
    // Wednesday March 18, 2026 15:00 ET = 19:00 UTC (after 2 PM ET)
    vi.setSystemTime(new Date('2026-03-18T19:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.is2x).toBe(false)
    expect(status.isWeekend).toBe(false)
    expect(status.nextWindowStart).toBeTruthy()
  })

  it('returns is2x=true all day on weekends', () => {
    // Saturday March 14, 2026 20:00 ET = Sunday March 15, 2026 01:00 UTC
    vi.setSystemTime(new Date('2026-03-15T01:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.is2x).toBe(true)
    expect(status.isWeekend).toBe(true)
  })

  it('returns is2x=true on Sunday', () => {
    // Sunday March 15, 2026 14:00 ET = 18:00 UTC
    vi.setSystemTime(new Date('2026-03-15T18:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.is2x).toBe(true)
    expect(status.isWeekend).toBe(true)
  })

  it('edge: exactly 8 AM ET on weekday is 2x', () => {
    // Wednesday March 18, 2026 08:00 ET = 12:00 UTC
    vi.setSystemTime(new Date('2026-03-18T12:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.is2x).toBe(true)
  })

  it('edge: exactly 2 PM ET (14:00) on weekday is NOT 2x', () => {
    // Wednesday March 18, 2026 14:00 ET = 18:00 UTC
    vi.setSystemTime(new Date('2026-03-18T18:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.is2x).toBe(false)
  })

  it('calculates expiresInSeconds correctly during weekday 2x', () => {
    // Wednesday March 18, 2026 12:00 ET = 16:00 UTC → 2 hours until 2 PM ET
    vi.setSystemTime(new Date('2026-03-18T16:00:00Z'))
    const checker = new PromoChecker([])
    const status = checker.check()

    expect(status.expiresInSeconds).toBe(2 * 3600) // 2 hours
  })

  it('getLastData returns last check result', () => {
    vi.setSystemTime(new Date('2026-03-18T15:00:00Z'))
    const checker = new PromoChecker([])
    checker.check()

    const last = checker.getLastData()
    expect(last).toBeTruthy()
    expect(last!.promoActive).toBe(true)
  })

  it('getLastData returns null before first check', () => {
    const checker = new PromoChecker([])
    expect(checker.getLastData()).toBeNull()
  })

  it('broadcasts to windows on check', () => {
    vi.setSystemTime(new Date('2026-03-18T15:00:00Z'))
    const win = makeMockWindow()
    const checker = new PromoChecker([() => win as unknown as Electron.BrowserWindow])
    checker.check()

    expect(win.webContents.send).toHaveBeenCalledWith(
      'promo:update',
      expect.objectContaining({
        promoActive: true
      })
    )
  })

  it('skips destroyed windows', () => {
    vi.setSystemTime(new Date('2026-03-18T15:00:00Z'))
    const destroyed = makeMockWindow(true)
    const live = makeMockWindow(false)
    const checker = new PromoChecker([
      () => destroyed as unknown as Electron.BrowserWindow,
      () => live as unknown as Electron.BrowserWindow
    ])
    checker.check()

    expect(destroyed.webContents.send).not.toHaveBeenCalled()
    expect(live.webContents.send).toHaveBeenCalled()
  })

  it('skips null windows', () => {
    vi.setSystemTime(new Date('2026-03-18T15:00:00Z'))
    const live = makeMockWindow(false)
    const checker = new PromoChecker([() => null, () => live as unknown as Electron.BrowserWindow])
    checker.check()

    expect(live.webContents.send).toHaveBeenCalled()
  })

  it('startPolling checks periodically', () => {
    vi.setSystemTime(new Date('2026-03-18T15:00:00Z'))
    const win = makeMockWindow()
    const checker = new PromoChecker([() => win as unknown as Electron.BrowserWindow])
    checker.startPolling(60_000)

    // Initial check
    expect(win.webContents.send).toHaveBeenCalledTimes(1)

    // After interval
    vi.advanceTimersByTime(60_000)
    expect(win.webContents.send).toHaveBeenCalledTimes(2)

    checker.stopPolling()
    vi.advanceTimersByTime(60_000)
    expect(win.webContents.send).toHaveBeenCalledTimes(2)
  })
})
