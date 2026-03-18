import { useState, useEffect, useCallback } from 'react'
import type { UpdateStatus, UpdateInfo, UpdateProgress, UpdaterStatusPayload } from '../lib/types'

interface UseUpdaterReturn {
  status: UpdateStatus
  updateInfo: UpdateInfo | null
  progress: UpdateProgress | null
  error: string | null
  checkForUpdates: () => void
  downloadUpdate: () => void
  installUpdate: () => void
}

export function useUpdater(): UseUpdaterReturn {
  const [status, setStatus] = useState<UpdateStatus>('idle')
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [progress, setProgress] = useState<UpdateProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!window.api?.onUpdaterStatus) return

    const cleanup = window.api.onUpdaterStatus((payload: UpdaterStatusPayload) => {
      setStatus(payload.status)

      switch (payload.status) {
        case 'available':
          setUpdateInfo(payload.data as UpdateInfo)
          setError(null)
          break
        case 'downloading':
          setProgress(payload.data as UpdateProgress)
          setError(null)
          break
        case 'error':
          setError(payload.data as string)
          break
        case 'checking':
        case 'not-available':
        case 'downloaded':
          setError(null)
          break
      }
    })

    return cleanup
  }, [])

  const checkForUpdates = useCallback(() => {
    window.api?.checkForUpdates()
  }, [])

  const downloadUpdate = useCallback(() => {
    window.api?.downloadUpdate()
  }, [])

  const installUpdate = useCallback(() => {
    window.api?.installUpdate()
  }, [])

  return { status, updateInfo, progress, error, checkForUpdates, downloadUpdate, installUpdate }
}
