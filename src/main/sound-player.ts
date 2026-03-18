import { execFile } from 'child_process'
import { resolve, join } from 'path'
import { existsSync } from 'fs'
import { app } from 'electron'

export class SoundPlayer {
  private soundPath: string

  constructor() {
    // In production: process.resourcesPath/sounds/task-complete.aiff
    // In dev: resources/sounds/task-complete.aiff
    const isProd = app.isPackaged
    this.soundPath = isProd
      ? join(process.resourcesPath, 'sounds', 'task-complete.aiff')
      : resolve(__dirname, '../../resources/sounds/task-complete.aiff')
  }

  async playTaskComplete(): Promise<void> {
    if (!existsSync(this.soundPath)) {
      return
    }

    if (process.platform === 'darwin') {
      return new Promise<void>((res) => {
        execFile('afplay', [this.soundPath], (err) => {
          // Graceful no-op on error
          res()
        })
      })
    }

    if (process.platform === 'win32') {
      return new Promise<void>((res) => {
        const script = `(New-Object System.Media.SoundPlayer '${this.soundPath}').PlaySync()`
        execFile('powershell', ['-Command', script], (err) => {
          res()
        })
      })
    }

    // Linux and other platforms: no-op
  }
}
