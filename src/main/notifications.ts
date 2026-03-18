import { Notification } from 'electron'
import type { AppSettings, ClaudeInstance, SessionHistoryEntry } from '../renderer/lib/types'
import { formatDuration } from './format-utils'

export class NotificationManager {
  private getSettings: () => AppSettings

  constructor(settingsGetter: () => AppSettings) {
    this.getSettings = settingsGetter
  }

  notifyTaskComplete(instance: ClaudeInstance): void {
    const settings = this.getSettings()
    if (!settings.notifications.onTaskComplete || settings.notifications.doNotDisturb) {
      return
    }

    const notification = new Notification({
      title: '\u2705 Task complete',
      body: `${instance.projectName} \u2014 ran for ${instance.elapsedTime}`,
      silent: true // Always silent — we handle sound separately via SoundPlayer
    })
    notification.show()
  }

  notifyIdle(instance: ClaudeInstance): void {
    const settings = this.getSettings()
    if (!settings.notifications.onIdle || settings.notifications.doNotDisturb) {
      return
    }

    const notification = new Notification({
      title: 'Claude finished',
      body: `${instance.projectName} \u2014 ran for ${instance.elapsedTime}`,
      silent: !settings.notifications.sound
    })
    notification.show()
  }

  notifyExited(entry: SessionHistoryEntry): void {
    const settings = this.getSettings()
    if (!settings.notifications.onExited || settings.notifications.doNotDisturb) {
      return
    }

    const duration = formatDuration(entry.durationSeconds)
    const notification = new Notification({
      title: 'Claude session ended',
      body: `${entry.projectName} \u2014 ran for ${duration}`,
      silent: !settings.notifications.sound
    })
    notification.show()
  }
}
