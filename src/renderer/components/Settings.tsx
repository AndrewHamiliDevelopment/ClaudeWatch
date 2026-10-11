import { useSettings } from '../hooks/useSettings'
import { FIELD_CLASS, SEGMENT_CLASS } from './deck/deck-styles'
import { RangeSetting, SettingRow, SettingsSection, ToggleSwitch } from './settings/controls'
import { NotificationSettings } from './settings/NotificationSettings'
import { UpdatesSection } from './settings/UpdatesSection'

const pollingOptions = [
  { value: 1000, label: '1s' },
  { value: 3000, label: '3s' },
  { value: 5000, label: '5s' },
  { value: 10000, label: '10s' }
]

const TOKENS_PER_MILLION = 1_000_000

export function Settings() {
  const { settings, updateSettings, loading } = useSettings()

  if (loading) {
    return (
      <p className="py-10 text-center text-body text-text-secondary" role="status">
        Loading settings…
      </p>
    )
  }

  return (
    <div className="no-drag flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div
        className="no-drag flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1"
        data-testid="settings-scroll-region"
      >
        <h1 className="pt-1 font-plate text-count">Settings</h1>

        <SettingsSection title="Monitoring">
          <SettingRow
            label="Polling interval"
            description="How often to check for Claude processes"
          >
            <div className="flex gap-1" role="radiogroup" aria-label="Polling interval">
              {pollingOptions.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={settings.pollingIntervalMs === value}
                  onClick={() => updateSettings({ pollingIntervalMs: value })}
                  className={SEGMENT_CLASS}
                >
                  {label}
                </button>
              ))}
            </div>
          </SettingRow>

          <SettingRow
            label="CPU idle threshold"
            description={`Below ${settings.cpuIdleThreshold.toFixed(1)}% CPU an agent counts as idle`}
          >
            <RangeSetting
              label="CPU idle threshold"
              min={0.5}
              max={5}
              step={0.5}
              value={settings.cpuIdleThreshold}
              valueText={`${settings.cpuIdleThreshold.toFixed(1)}%`}
              onChange={(cpuIdleThreshold) => updateSettings({ cpuIdleThreshold })}
            />
          </SettingRow>

          <SettingRow
            label="Stale threshold"
            description={`An agent idle for ${settings.staleThresholdMinutes} min is marked stale and left out of counts`}
          >
            <RangeSetting
              label="Stale threshold in minutes"
              min={5}
              max={120}
              step={5}
              value={settings.staleThresholdMinutes}
              valueText={`${settings.staleThresholdMinutes}m`}
              onChange={(staleThresholdMinutes) => updateSettings({ staleThresholdMinutes })}
            />
          </SettingRow>
        </SettingsSection>

        <NotificationSettings
          notifications={settings.notifications}
          onChange={(notifications) => updateSettings({ notifications })}
        />

        <SettingsSection title="Usage limits">
          <SettingRow
            label="Weekly token target"
            description={`Track usage against ${(settings.weeklyTokenTarget / TOKENS_PER_MILLION).toFixed(1)}M tokens a week`}
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                name="weekly-token-target"
                autoComplete="off"
                inputMode="numeric"
                min={100000}
                max={100000000}
                step={500000}
                value={settings.weeklyTokenTarget}
                onChange={(event) => {
                  const weeklyTokenTarget = parseInt(event.target.value, 10)
                  if (!isNaN(weeklyTokenTarget)) updateSettings({ weeklyTokenTarget })
                }}
                className={`${FIELD_CLASS} h-8 w-28 px-2 text-right tabular-nums`}
                aria-label="Weekly token target"
              />
              <span className="text-xs text-text-secondary">tokens</span>
            </div>
          </SettingRow>
        </SettingsSection>

        <SettingsSection title="Appearance">
          {/* The stored theme can still say light or system; every value draws the dark deck. */}
          <SettingRow
            label="Theme"
            description="The deck has one theme. A light theme is not available yet."
          >
            <span className="text-body text-text-secondary">Dark</span>
          </SettingRow>
        </SettingsSection>

        <SettingsSection title="System">
          <SettingRow label="Launch at login" description="Start ClaudeWatch when you log in">
            <ToggleSwitch
              checked={settings.launchAtLogin}
              onChange={(launchAtLogin) => updateSettings({ launchAtLogin })}
              label="Launch at login"
            />
          </SettingRow>

          <SettingRow
            label="Open the Office on start"
            description="Show the agent office as soon as ClaudeWatch starts"
          >
            <ToggleSwitch
              checked={settings.openOfficeOnLaunch}
              onChange={(openOfficeOnLaunch) => updateSettings({ openOfficeOnLaunch })}
              label="Open the Office on start"
            />
          </SettingRow>

          <SettingRow
            label="Minimize to tray"
            description="Hide the window to the tray instead of the dock"
          >
            <ToggleSwitch
              checked={settings.minimizeToTray}
              onChange={(minimizeToTray) => updateSettings({ minimizeToTray })}
              label="Minimize to tray"
            />
          </SettingRow>
        </SettingsSection>

        <UpdatesSection />
      </div>
    </div>
  )
}
