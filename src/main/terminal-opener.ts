import { execFilePromise } from './platform/exec'
import type { TerminalType } from '../renderer/lib/types'
import type { AgentCommand } from './orca-terminals'

const EXEC_TIMEOUT = 10_000

const toResult = (run: Promise<unknown>): Promise<{ success: boolean }> =>
  run.then(
    () => ({ success: true }),
    () => ({ success: false })
  )

function runCommand(cmd: string, args: string[]): Promise<{ success: boolean }> {
  return toResult(execFilePromise(cmd, args, { timeout: EXEC_TIMEOUT }))
}

// The path reaches AppleScript as argv and the shell via `quoted form of`, so no
// character in a folder name can end the string or start a command substitution.
function runOsascript(
  script: string,
  projectPath: string,
  ...extraArgs: string[]
): Promise<{ success: boolean }> {
  const wrapped = `on run argv\nset projectPath to item 1 of argv\n${script}\nend run`
  return runCommand('osascript', ['-e', wrapped, projectPath, ...extraArgs])
}

const CD_INTO_PROJECT = '"cd " & quoted form of projectPath'

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
          keystroke ${CD_INTO_PROJECT} & return
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
        write text ${CD_INTO_PROJECT}
      end tell
    end tell
  `
  return runOsascript(script, projectPath)
}

function openTerminalApp(projectPath: string): Promise<{ success: boolean }> {
  const script = `
    tell application "Terminal"
      activate
      do script ${CD_INTO_PROJECT}
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
        keystroke ${CD_INTO_PROJECT} & return
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

// What `open -a` calls each terminal app. A multiplexer or an unknown host names none.
const APP_NAMES: Partial<Record<TerminalType, string>> = {
  'terminal-app': 'Terminal',
  iterm2: 'iTerm',
  warp: 'Warp',
  alacritty: 'Alacritty',
  kitty: 'kitty',
  wezterm: 'WezTerm',
  hyper: 'Hyper',
  ghostty: 'Ghostty',
  vscode: 'Visual Studio Code',
  cursor: 'Cursor'
}

// Brings the terminal app forward and nothing more: no tab, no window, no keystroke. For a
// caller that may not type, where `openTerminal` would type `cd` into the app.
export function raiseTerminal(terminalType?: TerminalType): Promise<{ success: boolean }> {
  const app = terminalType && APP_NAMES[terminalType]
  return app ? runCommand('/usr/bin/open', ['-a', app]) : Promise.resolve({ success: false })
}

// Fallback for starting an agent when Orca is not running: a Terminal.app window in the folder.
export function openTerminalRunning(
  projectPath: string,
  command: AgentCommand
): Promise<{ success: boolean }> {
  const script = `
    tell application "Terminal"
      activate
      do script ${CD_INTO_PROJECT} & " && " & quoted form of (item 2 of argv)
    end tell
  `
  return runOsascript(script, projectPath, command)
}
