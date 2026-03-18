import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExecFile = vi.fn()

vi.mock('child_process', () => ({
  execFile: (...args: unknown[]) => mockExecFile(...args)
}))

import { openTerminal } from './terminal-opener'

describe('openTerminal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dispatches to Warp opener for "warp"', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project', 'warp')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('tell application "Warp"')],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('dispatches to iTerm2 opener for "iterm2"', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project', 'iterm2')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('tell application "iTerm2"')],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('dispatches to Terminal.app opener for "terminal-app"', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project', 'terminal-app')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('tell application "Terminal"')],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('dispatches to VS Code opener for "vscode"', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project', 'vscode')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'code',
      ['/Users/dev/project'],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('dispatches to Cursor opener for "cursor"', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project', 'cursor')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'cursor',
      ['/Users/dev/project'],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('dispatches to kitty opener for "kitty"', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project', 'kitty')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'kitty',
      ['@', 'launch', '--cwd', '/Users/dev/project'],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('dispatches to wezterm opener for "wezterm"', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project', 'wezterm')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'wezterm',
      ['cli', 'spawn', '--cwd', '/Users/dev/project'],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('dispatches to Ghostty opener for "ghostty"', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project', 'ghostty')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'osascript',
      ['-e', expect.stringContaining('tell application "Ghostty"')],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('falls back to default for unknown terminal type', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project', 'unknown')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'open',
      ['-a', 'Terminal', '/Users/dev/project'],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('falls back to default when terminalType is undefined', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const result = await openTerminal('/Users/dev/project')

    expect(result).toEqual({ success: true })
    expect(mockExecFile).toHaveBeenCalledWith(
      'open',
      ['-a', 'Terminal', '/Users/dev/project'],
      expect.objectContaining({ timeout: 10_000 }),
      expect.any(Function)
    )
  })

  it('handles AppleScript execution failure gracefully', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(new Error('osascript failed'))
      }
    )

    const result = await openTerminal('/Users/dev/project', 'warp')

    expect(result).toEqual({ success: false })
  })

  it('escapes special characters in project paths', async () => {
    mockExecFile.mockImplementation(
      (_cmd: string, _args: string[], _opts: unknown, cb: Function) => {
        cb(null)
      }
    )

    const pathWithSpecialChars = '/Users/dev/my "project" path\\here'
    await openTerminal(pathWithSpecialChars, 'warp')

    const scriptArg = mockExecFile.mock.calls[0][1][1] as string
    // Backslash should be escaped to double-backslash
    expect(scriptArg).toContain('\\\\')
    // Double quotes should be escaped
    expect(scriptArg).toContain('\\"')
    // The raw unescaped characters should NOT appear in the AppleScript
    expect(scriptArg).not.toContain('my "project"')
  })
})
