import { BrowserWindow } from 'electron'
import type { PromoStatus } from '../renderer/lib/types'

const PROMO_START = '2026-03-13'
const PROMO_END = '2026-03-27'
const PROMO_PERIOD = 'March 13–27, 2026'
const WEEKDAY_START_HOUR_ET = 8
const WEEKDAY_END_HOUR_ET = 14
const ET_TIMEZONE = 'America/New_York'

export class PromoChecker {
  private getWindows: (() => BrowserWindow | null)[]
  private interval: NodeJS.Timeout | null = null
  private lastData: PromoStatus | null = null

  constructor(getWindows: (() => BrowserWindow | null)[]) {
    this.getWindows = getWindows
  }

  check(): PromoStatus {
    const now = new Date()

    const etParts = new Intl.DateTimeFormat('en-US', {
      timeZone: ET_TIMEZONE,
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
      etParts.find((p) => p.type === type)?.value ?? ''

    const etYear = Number(get('year'))
    const etMonth = Number(get('month'))
    const etDay = Number(get('day'))
    const etHour = Number(get('hour'))
    const etMinute = Number(get('minute'))
    const etSecond = Number(get('second'))
    const etWeekday = get('weekday') // "Mon", "Tue", etc.

    const etDateStr = `${etYear}-${String(etMonth).padStart(2, '0')}-${String(etDay).padStart(2, '0')}`
    const promoActive = etDateStr >= PROMO_START && etDateStr <= PROMO_END

    const isWeekend = etWeekday === 'Sat' || etWeekday === 'Sun'

    let is2x = false
    let expiresInSeconds: number | null = null
    let currentWindowEnd: string | null = null
    let nextWindowStart: string | null = null

    if (promoActive) {
      if (isWeekend) {
        is2x = true
        // Expires at end of day ET
        const secondsLeftInDay = (23 - etHour) * 3600 + (59 - etMinute) * 60 + (59 - etSecond)
        expiresInSeconds = secondsLeftInDay
        currentWindowEnd = this.formatLocalTime(23, 59)
      } else {
        // Weekday: 8 AM – 2 PM ET
        if (etHour >= WEEKDAY_START_HOUR_ET && etHour < WEEKDAY_END_HOUR_ET) {
          is2x = true
          const secondsUntilEnd =
            (WEEKDAY_END_HOUR_ET - etHour - 1) * 3600 + (60 - etMinute) * 60 - etSecond
          expiresInSeconds = secondsUntilEnd
          currentWindowEnd = this.formatLocalTimeFromET(WEEKDAY_END_HOUR_ET, 0)
        } else {
          is2x = false
          if (etHour < WEEKDAY_START_HOUR_ET) {
            nextWindowStart = this.formatLocalTimeFromET(WEEKDAY_START_HOUR_ET, 0)
          } else {
            // After 2 PM on weekday — next window is tomorrow
            nextWindowStart = this.getNextWindowHint(etWeekday)
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

  private formatLocalTimeFromET(etHour: number, etMinute: number): string {
    // Create a date in ET, then format in local time
    // Use a known date during the promo to get correct ET offset
    const ref = new Date()
    // Build an ET time string and convert
    const etStr = new Intl.DateTimeFormat('en-US', {
      timeZone: ET_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(ref)

    // Parse ET date
    const [month, day, year] = etStr.split('/')
    // Create a date at the target ET time using UTC offset approach
    const target = new Date(
      `${year}-${month}-${day}T${String(etHour).padStart(2, '0')}:${String(etMinute).padStart(2, '0')}:00`
    )

    // This creates a date interpreted as local time — we need ET
    // Instead, use a simpler approach: calculate offset
    const nowUtc = ref.getTime()
    const etFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: ET_TIMEZONE,
      hour: 'numeric',
      minute: '2-digit'
    })

    // Get current ET hour and compute the offset from local
    const localHour = ref.getHours()
    const etParts = new Intl.DateTimeFormat('en-US', {
      timeZone: ET_TIMEZONE,
      hour: '2-digit',
      hour12: false
    }).format(ref)
    const currentEtHour = Number(etParts)
    const offsetHours = localHour - currentEtHour

    const localTargetHour = etHour + offsetHours
    const d = new Date(ref)
    d.setHours(localTargetHour, etMinute, 0, 0)
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  private getPeakHoursLocal(): string {
    const start = this.formatLocalTimeFromET(WEEKDAY_START_HOUR_ET, 0)
    const end = this.formatLocalTimeFromET(WEEKDAY_END_HOUR_ET, 0)
    return `${start} – ${end}`
  }

  private getNextWindowHint(etWeekday: string): string {
    // If Friday after 2 PM, next is Saturday (all day)
    if (etWeekday === 'Fri') return 'Saturday (all day)'
    // Otherwise, next weekday at 8 AM ET
    return this.formatLocalTimeFromET(WEEKDAY_START_HOUR_ET, 0) + ' tomorrow'
  }
}
