import { useEffect, useState } from 'react'
import { Bell, ExternalLink, TriangleAlert, X } from 'lucide-react'
import { COOLDOWN_SECONDS_RANGE } from '../../../shared/settings-ranges'
import type { AppSettings } from '../../lib/types'
import { BUTTON_QUIET_COMPACT_CLASS, ICON_BUTTON_CLASS } from '../deck/deck-styles'
import { RangeSetting, SettingRow, SettingsSection, ToggleSwitch } from './controls'

type NotificationSettingsValue = AppSettings['notifications']
type NotificationToggleKey = {
  [Key in keyof NotificationSettingsValue]: NotificationSettingsValue[Key] extends boolean
    ? Key
    : never
}[keyof NotificationSettingsValue]

const TOGGLES: { key: NotificationToggleKey; label: string; description: string; name: string }[] =
  [
    {
      key: 'onTaskComplete',
      label: 'On task complete',
      description: 'Notify when an agent finishes its turn',
      name: 'Notify on task complete'
    },
    {
      key: 'onIdle',
      label: 'On idle',
      description: 'Notify when an agent becomes idle',
      name: 'Notify on idle'
    },
    {
      key: 'onExited',
      label: 'On exited',
      description: 'Notify when an agent exits',
      name: 'Notify on exited'
    },
    {
      key: 'onError',
      label: 'On error',
      description: 'Notify when an error is detected',
      name: 'Notify on error'
    },
    {
      key: 'pingSound',
      label: 'Ping sound',
      description: 'Play a chime when a task completes',
      name: 'Ping sound'
    },
    {
      key: 'sound',
      label: 'Sound',
      description: 'Play notification sounds',
      name: 'Notification sound'
    },
    {
      key: 'doNotDisturb',
      label: 'Do not disturb',
      description: 'Suppress all notifications',
      name: 'Do not disturb'
    }
  ]

interface NotificationSettingsProps {
  notifications: NotificationSettingsValue
  onChange: (notifications: NotificationSettingsValue) => void
}

export function NotificationSettings({ notifications, onChange }: NotificationSettingsProps) {
  const mutedProjects = notifications.mutedProjects ?? []

  const handleUnmute = (projectPath: string): void => {
    void window.api?.unmuteProject(projectPath).then(() =>
      onChange({
        ...notifications,
        mutedProjects: mutedProjects.filter((mutedPath) => mutedPath !== projectPath)
      })
    )
  }

  return (
    <SettingsSection title="Notifications">
      <PermissionWarning />

      <SettingRow label="System settings" description="Banners, alerts and sounds in macOS">
        <button
          type="button"
          onClick={() => void window.api?.openNotificationSettings()}
          className={BUTTON_QUIET_COMPACT_CLASS}
        >
          <ExternalLink className="size-3.5" aria-hidden="true" />
          Open notification settings
        </button>
      </SettingRow>

      <TestNotificationRow />

      {TOGGLES.map(({ key, label, description, name }) => (
        <SettingRow key={key} label={label} description={description}>
          <ToggleSwitch
            checked={notifications[key]}
            onChange={(isChecked) => onChange({ ...notifications, [key]: isChecked })}
            label={name}
          />
        </SettingRow>
      ))}

      <SettingRow
        label="Notification cooldown"
        description={`Suppress duplicate notifications within ${notifications.cooldownSeconds}s`}
      >
        <RangeSetting
          label="Notification cooldown in seconds"
          min={COOLDOWN_SECONDS_RANGE[0]}
          max={COOLDOWN_SECONDS_RANGE[1]}
          step={5}
          value={notifications.cooldownSeconds}
          valueText={`${notifications.cooldownSeconds}s`}
          onChange={(cooldownSeconds) => onChange({ ...notifications, cooldownSeconds })}
        />
      </SettingRow>

      <div className="mt-1 border-t border-border py-2.5">
        {mutedProjects.length === 0 ? (
          <p className="text-xs text-text-secondary">No projects muted</p>
        ) : (
          <>
            <h3 className="mb-1 text-xs font-semibold text-text-secondary">Muted projects</h3>
            <ul className="flex flex-col gap-0.5">
              {mutedProjects.map((projectPath) => (
                <li key={projectPath} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 select-text truncate font-mono text-xs text-text-secondary">
                    {projectPath}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleUnmute(projectPath)}
                    className={ICON_BUTTON_CLASS}
                    aria-label={`Unmute ${projectPath}`}
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </SettingsSection>
  )
}

function PermissionWarning() {
  const [isSupported, setIsSupported] = useState<boolean | null>(null)

  useEffect(() => {
    if (!window.api?.checkNotificationPermission) return
    window.api
      .checkNotificationPermission()
      .then((permission) => setIsSupported(permission?.supported ?? null))
      .catch(() => setIsSupported(null))
  }, [])

  if (isSupported !== false) return null

  return (
    <p className="my-2 flex items-start gap-2 rounded-md border border-border-strong bg-surface p-2.5 text-xs text-text-primary">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0 text-accent-hot" aria-hidden="true" />
      <span>
        Notifications are off for ClaudeWatch. Open{' '}
        <strong className="font-semibold">System Settings, Notifications, ClaudeWatch</strong> and
        turn on Allow Notifications.
      </span>
    </p>
  )
}

const SENT_FEEDBACK_MS = 3000
const FAILED_FEEDBACK_MS = 5000

function TestNotificationRow() {
  const [feedback, setFeedback] = useState<string | null>(null)

  const handleSendTest = async (): Promise<void> => {
    if (!window.api?.sendTestNotification) return
    const delivery = await window.api.sendTestNotification()
    setFeedback(delivery.sent ? 'Sent' : (delivery.reason ?? 'Could not send'))
    setTimeout(() => setFeedback(null), delivery.sent ? SENT_FEEDBACK_MS : FAILED_FEEDBACK_MS)
  }

  return (
    <SettingRow label="Test notification" description="Check that notifications reach you">
      <div className="flex items-center gap-2">
        <span className="text-xs text-text-primary" role="status">
          {feedback}
        </span>
        <button
          type="button"
          onClick={() => void handleSendTest()}
          className={BUTTON_QUIET_COMPACT_CLASS}
        >
          <Bell className="size-3.5" aria-hidden="true" />
          Send test
        </button>
      </div>
    </SettingRow>
  )
}
