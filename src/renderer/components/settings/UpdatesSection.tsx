import { CheckCircle, Download, RefreshCw } from 'lucide-react'
import { useUpdater } from '../../hooks/useUpdater'
import type { UpdateStatus } from '../../lib/types'
import { BUTTON_PRIMARY_COMPACT_CLASS, BUTTON_QUIET_COMPACT_CLASS } from '../deck/deck-styles'
import { SegmentedMeter } from '../deck/SegmentedMeter'
import { SettingsSection } from './controls'

const STATUS_LABEL: Record<UpdateStatus, string> = {
  idle: 'Up to date',
  checking: 'Checking for updates…',
  available: 'Update available',
  'not-available': 'You’re on the latest version',
  downloading: 'Downloading update…',
  downloaded: 'Update ready to install',
  error: 'Update check failed'
}

const CAN_CHECK: ReadonlySet<UpdateStatus> = new Set(['idle', 'not-available', 'error'])

export function UpdatesSection() {
  const { status, updateInfo, progress, error, checkForUpdates, downloadUpdate, installUpdate } =
    useUpdater()
  const downloadPercent = progress ? Math.min(100, Math.round(progress.percent)) : 0

  return (
    <SettingsSection title="Updates">
      <div className="flex flex-col gap-2 py-2.5">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-body font-semibold text-text-primary" role="status">
              {STATUS_LABEL[status]}
              {updateInfo && status === 'available' && (
                <span className="ml-1.5 text-xs text-accent">v{updateInfo.version}</span>
              )}
            </p>
            {error && <p className="mt-0.5 text-xs text-accent-hot">{error}</p>}
          </div>

          <div className="shrink-0">
            {CAN_CHECK.has(status) && (
              <button
                type="button"
                onClick={checkForUpdates}
                className={BUTTON_QUIET_COMPACT_CLASS}
                aria-label="Check for updates"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                Check
              </button>
            )}
            {status === 'checking' && (
              <RefreshCw
                className="size-3.5 text-text-secondary motion-safe:animate-spin"
                aria-hidden="true"
              />
            )}
            {status === 'available' && (
              <button
                type="button"
                onClick={downloadUpdate}
                className={BUTTON_PRIMARY_COMPACT_CLASS}
                aria-label="Download update"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Download
              </button>
            )}
            {status === 'downloaded' && (
              <button
                type="button"
                onClick={installUpdate}
                className={BUTTON_PRIMARY_COMPACT_CLASS}
                aria-label="Install update and restart"
              >
                <CheckCircle className="size-3.5" aria-hidden="true" />
                Install and restart
              </button>
            )}
          </div>
        </div>

        {status === 'downloading' && progress && (
          <div className="flex items-center gap-2">
            <SegmentedMeter
              label="Download progress"
              percent={downloadPercent}
              valueText={`${downloadPercent}%`}
              className="flex-1"
            />
            <span className="text-xs tabular-nums text-text-secondary">{downloadPercent}%</span>
          </div>
        )}
      </div>
    </SettingsSection>
  )
}
