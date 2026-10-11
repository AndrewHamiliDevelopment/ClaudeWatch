import { Notification } from 'electron'
import type { AppSettings, ClaudeInstance, SessionHistoryEntry } from '../renderer/lib/types'
import { formatDuration } from './format-utils'

const MAX_HELD_NOTIFICATIONS = 20

export class NotificationManager {
  private getSettings: () => AppSettings
  // Electron drops a notification, and with it the click, once its object is collected.
  private readonly awaitingClick = new Set<Notification>()

  constructor(
    settingsGetter: () => AppSettings,
    private readonly onFocus: (pid: number) => void
  ) {
    this.getSettings = settingsGetter
  }

  private focusOnClick(notification: Notification, pid: number): void {
    const release = (): boolean => this.awaitingClick.delete(notification)
    notification.on('click', () => {
      release()
      this.onFocus(pid)
    })
    notification.on('close', release)
    this.awaitingClick.add(notification)
    // macOS does not always report a dismissal, so the oldest make room.
    for (const oldest of this.awaitingClick) {
      if (this.awaitingClick.size <= MAX_HELD_NOTIFICATIONS) break
      this.awaitingClick.delete(oldest)
    }
  }

  /** Check whether native notifications are supported on this platform */
  isSupported(): boolean {
    return Notification.isSupported()
  }

  /** Send a test notification to verify the system works */
  sendTest(): { sent: boolean; reason?: string } {
    if (!Notification.isSupported()) {
      return { sent: false, reason: 'Notifications not supported — check macOS settings' }
    }

    const notification = new Notification({
      title: '\uD83D\uDD14 Test notification',
      body: 'ClaudeWatch notifications are working!',
      silent: true
    })
    notification.show()
    return { sent: true }
  }

  private isProjectMuted(projectPath: string): boolean {
    const settings = this.getSettings()
    const mutedProjects = settings.notifications.mutedProjects ?? []
    return mutedProjects.includes(projectPath)
  }

  notifyTaskComplete(instance: ClaudeInstance): void {
    const settings = this.getSettings()
    if (!settings.notifications.onTaskComplete || settings.notifications.doNotDisturb) {
      console.log(
        `[notifications] notifyTaskComplete suppressed for pid=${instance.pid} project=${instance.projectName} (onTaskComplete=${settings.notifications.onTaskComplete}, dnd=${settings.notifications.doNotDisturb})`
      )
      return
    }

    if (this.isProjectMuted(instance.projectPath)) {
      console.log(
        `[notifications] notifyTaskComplete suppressed for pid=${instance.pid} — project muted: ${instance.projectPath}`
      )
      return
    }

    if (!Notification.isSupported()) {
      console.warn(
        '[notifications] notifyTaskComplete: Notification.isSupported() returned false — macOS notification permission may be denied'
      )
      return
    }

    console.log(
      `[notifications] Showing task-complete notification for pid=${instance.pid} project=${instance.projectName}`
    )
    const notification = new Notification({
      title: '\u2705 Task complete',
      body: `${instance.projectName} \u2014 ran for ${instance.elapsedTime}`,
      silent: true // Always silent — we handle sound separately via SoundPlayer
    })
    this.focusOnClick(notification, instance.pid)
    notification.show()
  }

  notifyIdle(instance: ClaudeInstance): void {
    const settings = this.getSettings()
    if (!settings.notifications.onIdle || settings.notifications.doNotDisturb) {
      console.log(
        `[notifications] notifyIdle suppressed for pid=${instance.pid} (onIdle=${settings.notifications.onIdle}, dnd=${settings.notifications.doNotDisturb})`
      )
      return
    }

    if (this.isProjectMuted(instance.projectPath)) {
      console.log(
        `[notifications] notifyIdle suppressed for pid=${instance.pid} — project muted: ${instance.projectPath}`
      )
      return
    }

    if (!Notification.isSupported()) {
      console.warn(
        '[notifications] notifyIdle: Notification.isSupported() returned false — macOS notification permission may be denied'
      )
      return
    }

    console.log(
      `[notifications] Showing idle notification for pid=${instance.pid} project=${instance.projectName}`
    )
    const notification = new Notification({
      title: 'Claude finished',
      body: `${instance.projectName} \u2014 ran for ${instance.elapsedTime}`,
      silent: !settings.notifications.sound
    })
    this.focusOnClick(notification, instance.pid)
    notification.show()
  }

  notifyExited(entry: SessionHistoryEntry): void {
    const settings = this.getSettings()
    if (!settings.notifications.onExited || settings.notifications.doNotDisturb) {
      console.log(
        `[notifications] notifyExited suppressed for pid=${entry.pid} (onExited=${settings.notifications.onExited}, dnd=${settings.notifications.doNotDisturb})`
      )
      return
    }

    if (this.isProjectMuted(entry.projectPath)) {
      console.log(
        `[notifications] notifyExited suppressed for pid=${entry.pid} — project muted: ${entry.projectPath}`
      )
      return
    }

    if (!Notification.isSupported()) {
      console.warn(
        '[notifications] notifyExited: Notification.isSupported() returned false — macOS notification permission may be denied'
      )
      return
    }

    console.log(
      `[notifications] Showing exited notification for pid=${entry.pid} project=${entry.projectName}`
    )
    const duration = formatDuration(entry.durationSeconds)
    const notification = new Notification({
      title: 'Claude session ended',
      body: `${entry.projectName} \u2014 ran for ${duration}`,
      silent: !settings.notifications.sound
    })
    notification.show()
  }
}
