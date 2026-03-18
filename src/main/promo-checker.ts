import { BrowserWindow } from 'electron'
import type { PromoStatus } from '../renderer/lib/types'

const PROMO_START = '2026-03-13'
const PROMO_END = '2026-03-27'
const PROMO_PERIOD = 'March 13–27, 2026'
const WEEKDAY_START_HOUR_PHT = 2
const WEEKDAY_END_HOUR_PHT = 20
const PHT_TIMEZONE = 'Asia/Manila'

export class PromoChecker {
  private getWindows: (() => BrowserWindow | null)[]
  private interval: NodeJS.Timeout | null = null
  private lastData: PromoStatus | null = null

  constructor(getWindows: (() => BrowserWindow | null)[]) {
    this.getWindows = getWindows
  }

  check(): PromoStatus {
    const now = new Date()

    const phtParts = new Intl.DateTimeFormat('en-US', {
      timeZone: PHT_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      weekday: 'short'
    }).formatToParts(now)

    const get = (type: Intl.DateTimeFormatPartTypes): string =>
      phtParts.find((p) => p.type === type)?.value ?? ''

    const phtYear = Number(get('year'))
    const phtMonth = Number(get('month'))
    const phtDay = Number(get('day'))
    const phtHour = Number(get('hour'))
    const phtMinute = Number(get('minute'))
    const phtSecond = Number(get('second'))
    const phtWeekday = get('weekday') // "Mon", "Tue", etc.

    const phtDateStr = `${phtYear}-${String(phtMonth).padStart(2, '0')}-${String(phtDay).padStart(2, '0')}`
    const promoActive = phtDateStr >= PROMO_START && phtDateStr <= PROMO_END

    const isWeekend = phtWeekday === 'Sat' || phtWeekday === 'Sun'

    let is2x = false
    let expiresInSeconds: number | null = null
    let currentWindowEnd: string | null = null
    let nextWindowStart: string | null = null

    if (promoActive) {
      if (isWeekend) {
        is2x = true
        // Expires at end of day PHT
        const secondsLeftInDay = (23 - phtHour) * 3600 + (59 - phtMinute) * 60 + (59 - phtSecond)
        expiresInSeconds = secondsLeftInDay
        currentWindowEnd = this.formatLocalTime(23, 59)
      } else {
        // Weekday: 2 AM – 8 PM PHT
        if (phtHour >= WEEKDAY_START_HOUR_PHT && phtHour < WEEKDAY_END_HOUR_PHT) {
          is2x = true
          const secondsUntilEnd =
            (WEEKDAY_END_HOUR_PHT - phtHour - 1) * 3600 + (60 - phtMinute) * 60 - phtSecond
          expiresInSeconds = secondsUntilEnd
          currentWindowEnd = this.formatLocalTimeFromPHT(WEEKDAY_END_HOUR_PHT, 0)
        } else {
          is2x = false
          if (phtHour < WEEKDAY_START_HOUR_PHT) {
            nextWindowStart = this.formatLocalTimeFromPHT(WEEKDAY_START_HOUR_PHT, 0)
          } else {
            // After 8 PM on weekday — next window is tomorrow
            nextWindowStart = this.getNextWindowHint(phtWeekday)
          }
        }
      }
    }

    const peakHoursLocal = this.getPeakHoursLocal()

    const status: PromoStatus = {
      is2x,
      promoActive,
      isWeekend,
      currentWindowEnd,
      nextWindowStart,
      expiresInSeconds,
      promoPeriod: PROMO_PERIOD,
      peakHoursLocal
    }

    this.lastData = status
    this.send(status)
    return status
  }

  getLastData(): PromoStatus | null {
    return this.lastData
  }

  startPolling(intervalMs = 60_000): void {
    this.check()
    this.interval = setInterval(() => this.check(), intervalMs)
  }

  stopPolling(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  private send(data: PromoStatus): void {
    for (const getWin of this.getWindows) {
      const win = getWin()
      if (win && !win.isDestroyed()) {
        win.webContents.send('promo:update', data)
      }
    }
  }

  private formatLocalTime(hour: number, minute: number): string {
    const d = new Date()
    d.setHours(hour, minute, 0, 0)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  private formatLocalTimeFromPHT(phtHour: number, phtMinute: number): string {
    // Calculate offset between local time and PHT, then convert PHT hour to local
    const ref = new Date()
    const localHour = ref.getHours()
    const currentPhtHour = Number(
      new Intl.DateTimeFormat('en-US', {
        timeZone: PHT_TIMEZONE,
        hour: '2-digit',
        hour12: false
      }).format(ref)
    )
    const offsetHours = localHour - currentPhtHour

    const localTargetHour = phtHour + offsetHours
    const d = new Date(ref)
    d.setHours(localTargetHour, phtMinute, 0, 0)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  private getPeakHoursLocal(): string {
    const start = this.formatLocalTimeFromPHT(WEEKDAY_START_HOUR_PHT, 0)
    const end = this.formatLocalTimeFromPHT(WEEKDAY_END_HOUR_PHT, 0)
    return `${start} – ${end}`
  }

  private getNextWindowHint(phtWeekday: string): string {
    // If Friday after 8 PM PHT, next is Saturday (all day)
    if (phtWeekday === 'Fri') return 'Saturday (all day)'
    // Otherwise, next weekday at 2 AM PHT
    return this.formatLocalTimeFromPHT(WEEKDAY_START_HOUR_PHT, 0) + ' tomorrow'
  }
}
