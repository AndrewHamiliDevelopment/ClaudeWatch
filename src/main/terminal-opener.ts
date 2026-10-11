import { execFile } from 'child_process'
import type { TerminalType } from '../renderer/lib/types'

const EXEC_TIMEOUT = 10_000

// The path reaches AppleScript as argv and the shell via `quoted form of`, so no
// character in a folder name can end the string or start a command substitution.
function runOsascript(script: string, projectPath: string): Promise<{ success: boolean }> {
  return new Promise<{ success: boolean }>((resolve) => {
    execFile(
      'osascript',
      ['-e', `on run argv\nset projectPath to item 1 of argv\n${script}\nend run`, projectPath],
      { timeout: EXEC_TIMEOUT },
      (error) => {
        resolve({ success: !error })
      }
    )
  })
}

function runCommand(cmd: string, args: string[]): Promise<{ success: boolean }> {
  return new Promise<{ success: boolean }>((resolve) => {
    execFile(cmd, args, { timeout: EXEC_TIMEOUT }, (error) => {
      resolve({ success: !error })
    })
  })
}

// --- Opener functions per terminal type ---

function openWarp(projectPath: string): Promise<{ success: boolean }> {
  const script = `
    tell application "Warp"
      activate
    end tell
    delay 0.3
    tell application "System Events"
      tell process "Warp"
        set found to false
        repeat with w in windows
          set winName to name of w
          if winName contains projectPath then
            perform action "AXRaise" of w
            set found to true
            exit repeat
          end if
        end repeat
        if not found then
          keystroke "t" using command down
          delay 0.3
          keystroke "cd " & quoted form of projectPath & return
        end if
      end tell
    end tell
  `
  return runOsascript(script, projectPath)
}

function openITerm2(projectPath: string): Promise<{ success: boolean }> {
  const script = `
    tell application "iTerm2"
      activate
      set newWindow to (create window with default profile)
      tell current session of newWindow
        write text "cd " & quoted form of projectPath
      end tell
    end tell
  `
  return runOsascript(script, projectPath)
}

function openTerminalApp(projectPath: string): Promise<{ success: boolean }> {
  const script = `
    tell application "Terminal"
      activate
      do script "cd " & quoted form of projectPath
    end tell
  `
  return runOsascript(script, projectPath)
}

function openVSCode(projectPath: string): Promise<{ success: boolean }> {
  return runCommand('code', [projectPath])
}

function openCursor(projectPath: string): Promise<{ success: boolean }> {
  return runCommand('cursor', [projectPath])
}

function openKitty(projectPath: string): Promise<{ success: boolean }> {
  return runCommand('kitty', ['@', 'launch', '--cwd', projectPath])
}

function openWezterm(projectPath: string): Promise<{ success: boolean }> {
  return runCommand('wezterm', ['cli', 'spawn', '--cwd', projectPath])
}

function openGhostty(projectPath: string): Promise<{ success: boolean }> {
  const script = `
    tell application "Ghostty"
      activate
    end tell
    delay 0.3
    tell application "System Events"
      tell process "Ghostty"
        keystroke "t" using command down
        delay 0.3
        keystroke "cd " & quoted form of projectPath & return
      end tell
    end tell
  `
  return runOsascript(script, projectPath)
}

function openDefault(projectPath: string): Promise<{ success: boolean }> {
  return runCommand('open', ['-a', 'Terminal', projectPath])
}

// --- Registry ---

type OpenerFn = (projectPath: string) => Promise<{ success: boolean }>

const openerRegistry: Record<string, OpenerFn> = {
  warp: openWarp,
  iterm2: openITerm2,
  'terminal-app': openTerminalApp,
  vscode: openVSCode,
  cursor: openCursor,
  kitty: openKitty,
  wezterm: openWezterm,
  ghostty: openGhostty
}

export async function openTerminal(
  projectPath: string,
  terminalType?: TerminalType
): Promise<{ success: boolean }> {
  const opener = (terminalType && openerRegistry[terminalType]) || openDefault
  return opener(projectPath)
}
