import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExecFile = vi.fn()
const mockExistsSync = vi.fn()

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args)
}))

vi.mock('fs', () => ({
  existsSync: (p: string) => mockExistsSync(p)
}))

vi.mock('electron', () => ({
  app: {
    isPackaged: false
  }
}))

import { SoundPlayer } from './sound-player'

describe('SoundPlayer', () => {
  let player: SoundPlayer

  beforeEach(() => {
    vi.clearAllMocks()
    player = new SoundPlayer()
  })

  describe('playTaskComplete', () => {
    it('should no-op gracefully when sound file is missing', async () => {
      mockExistsSync.mockReturnValue(false)

      await player.playTaskComplete()

      expect(mockExecFile).not.toHaveBeenCalled()
    })

    it('should call afplay on macOS when sound file exists', async () => {
      mockExistsSync.mockReturnValue(true)
      mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: Function) => {
        cb(null)
      })

      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      await player.playTaskComplete()

      expect(mockExecFile).toHaveBeenCalledWith('afplay', expect.any(Array), expect.any(Function))

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })

    it('should resolve even if afplay fails', async () => {
      mockExistsSync.mockReturnValue(true)
      mockExecFile.mockImplementation((_cmd: string, _args: string[], cb: Function) => {
        cb(new Error('afplay failed'))
      })

      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true })

      // Should not throw
      await expect(player.playTaskComplete()).resolves.toBeUndefined()

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })

    it('should no-op on unsupported platforms', async () => {
      mockExistsSync.mockReturnValue(true)

      const originalPlatform = process.platform
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })

      await player.playTaskComplete()

      expect(mockExecFile).not.toHaveBeenCalled()

      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true })
    })
  })
})
